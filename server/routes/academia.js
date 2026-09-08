const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('../db');
const { studentToJSON, turmaToJSON, txToJSON, academiaToShape, presencaToJSON, graduacaoToJSON, recadoToJSON } = require('../mappers');
const { requireRole } = require('../auth');
const { r2Configurado, getR2Client } = require('../r2');
const { slugify } = require('../slugify');
const { getStripeClient, stripeConfigurado } = require('../stripe-client');
const asyncHandler = require('../asyncHandler');

// SVG fica de fora de propósito: pode carregar <script>/onload embutido, e
// GET /logo/:academiaId é uma rota pública que serve o arquivo com o
// content-type original — abrir esse link direto (fora de uma <img>)
// executaria o script no domínio do app.
const LOGO_MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB

/* Uma chamada só no login: tudo que o app precisa pra montar a tela inicial */
router.get('/bootstrap', asyncHandler(async (req, res) => {
  const [academiaRows] = await pool.query('SELECT * FROM academias WHERE id = ?', [req.academiaId]);
  if (!academiaRows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
  const [turmaRows] = await pool.query('SELECT * FROM turmas WHERE academia_id = ?', [req.academiaId]);
  const [studentRows] = await pool.query('SELECT * FROM students WHERE academia_id = ?', [req.academiaId]);
  // Operação só enxerga lançamentos vinculados a aluno (mensalidade/matrícula)
  // — o ledger completo (despesas, salários etc.) fica só com o dono.
  const txQuery = req.role === 'operacao'
    ? 'SELECT * FROM transactions WHERE academia_id = ? AND aluno_id IS NOT NULL'
    : 'SELECT * FROM transactions WHERE academia_id = ?';
  const [txRows] = await pool.query(txQuery, [req.academiaId]);
  const [presencaRows] = await pool.query('SELECT * FROM presencas WHERE academia_id = ?', [req.academiaId]);
  const [graduacaoRows] = await pool.query('SELECT * FROM graduacoes WHERE academia_id = ?', [req.academiaId]);
  const [recadoRows] = await pool.query('SELECT * FROM recados WHERE academia_id = ? ORDER BY created_at DESC', [req.academiaId]);

  const shape = academiaToShape(academiaRows[0]);
  res.json({
    ...shape,
    turmas: turmaRows.map(turmaToJSON),
    students: studentRows.map(studentToJSON),
    transactions: txRows.map(txToJSON),
    presencas: presencaRows.map(presencaToJSON),
    graduacoes: graduacaoRows.map(graduacaoToJSON),
    recados: recadoRows.map(recadoToJSON),
  });
}));

router.get('/academia', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM academias WHERE id = ?', [req.academiaId]);
  if (!rows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
  res.json(academiaToShape(rows[0]));
}));

const MODALIDADES_VALIDAS = ['bjj', 'judo', 'outro'];

router.put('/academia', requireRole('admin'), asyncHandler(async (req, res) => {
  const { meta, categoryGroups, cobrancaTemplates, graduacaoRegras } = req.body;

  // Slug vazio = "não quero link de marca" (fica NULL). Preenchido, normaliza
  // (sem acento/maiúscula/espaço) e garante que não colide com outra academia.
  let slug = null;
  if (meta.slug && meta.slug.trim()) {
    slug = slugify(meta.slug);
    if (!slug) return res.status(400).json({ error: 'Link inválido — use letras, números e hífen.' });
    const [existing] = await pool.query('SELECT id FROM academias WHERE slug = ? AND id != ?', [slug, req.academiaId]);
    if (existing[0]) return res.status(409).json({ error: 'Esse link já está em uso por outra academia.' });
  }

  // Só troca a modalidade se vier um valor reconhecido — evita apagar o
  // valor já salvo quando uma tela antiga (sem esse campo no formulário)
  // faz o round-trip de meta sem passar modalidade nenhuma.
  const modalidade = MODALIDADES_VALIDAS.includes(meta.modalidade) ? meta.modalidade : null;

  await pool.query(
    `UPDATE academias SET nome=?, slug=?, tatame_comprimento=?, tatame_largura=?, concentracao_pico=?, generated_months=?, category_groups=?, cobranca_templates=?, watermark_ativo=?, graduacao_regras=?, usa_grau=?, telefone=?${modalidade ? ', modalidade=?' : ''}
     WHERE id=?`,
    [meta.empresa, slug, meta.tatame.comprimento, meta.tatame.largura, meta.concentracaoPico,
     JSON.stringify(meta.generatedMonths || []), JSON.stringify(categoryGroups || {}), JSON.stringify(cobrancaTemplates || []),
     meta.watermarkAtivo ? 1 : 0, JSON.stringify(graduacaoRegras || {}), meta.usaGrau === false ? 0 : 1, meta.telefone || null,
     ...(modalidade ? [modalidade] : []), req.academiaId]
  );
  res.json({ ok: true, slug });
}));

// E-mail é o login do dono — trocar exige senha atual (mesma trava de
// segurança de trocar senha) e checa que ninguém mais já usa esse e-mail.
router.put('/academia/email', requireRole('admin'), asyncHandler(async (req, res) => {
  const { novoEmail, senhaAtual } = req.body || {};
  if (!novoEmail || !senhaAtual) return res.status(400).json({ error: 'Informe o novo e-mail e a senha atual.' });

  const [rows] = await pool.query('SELECT senha_hash FROM academias WHERE id = ?', [req.academiaId]);
  if (!rows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
  const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!ok) return res.status(400).json({ error: 'Senha atual incorreta.' });

  const [existing] = await pool.query('SELECT id FROM academias WHERE email = ? AND id != ? UNION SELECT id FROM usuarios WHERE email = ?', [novoEmail, req.academiaId, novoEmail]);
  if (existing[0]) return res.status(409).json({ error: 'Esse e-mail já está em uso.' });

  await pool.query('UPDATE academias SET email = ? WHERE id = ?', [novoEmail, req.academiaId]);
  res.json({ ok: true });
}));

router.put('/academia/senha', asyncHandler(async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  if (novaSenha.length < 8) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });

  // Dono da academia (role 'admin') mora em "academias"; equipe (role
  // 'operacao') mora em "usuarios" — cada papel troca a própria senha na
  // tabela onde o login dele realmente vive.
  const table = req.role === 'admin' ? 'academias' : 'usuarios';
  const targetId = req.role === 'admin' ? req.academiaId : req.userId;

  const [rows] = await pool.query(`SELECT senha_hash FROM ${table} WHERE id = ?`, [targetId]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!ok) return res.status(400).json({ error: 'Senha atual incorreta.' });

  const novoHash = await bcrypt.hash(novaSenha, 10);
  await pool.query(`UPDATE ${table} SET senha_hash = ? WHERE id = ?`, [novoHash, targetId]);
  res.json({ ok: true });
}));

/* Logo da academia — enviada como data URL (base64) direto do navegador,
   sem precisar de multer/multipart. Guardada no mesmo bucket R2 do backup
   (prefixo "logos/"), mas o bucket continua privado: quem serve a imagem
   pro navegador é a rota pública GET /logo/:academiaId em index.js, que
   busca com nossas próprias credenciais em vez de expor o bucket. */
router.put('/academia/logo', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!r2Configurado()) return res.status(503).json({ error: 'Upload de logo não configurado neste servidor.' });

  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec((req.body || {}).imageBase64 || '');
  if (!match) return res.status(400).json({ error: 'Envie uma imagem válida.' });

  const mime = match[1];
  const ext = LOGO_MIME_EXT[mime];
  if (!ext) return res.status(400).json({ error: 'Formato não suportado. Use PNG, JPG ou WEBP.' });

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > LOGO_MAX_BYTES) return res.status(400).json({ error: 'Imagem muito grande — máximo 2MB.' });

  const key = `logos/${req.academiaId}.${ext}`;
  const s3 = getR2Client();
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: mime }));
  await pool.query('UPDATE academias SET logo_key = ? WHERE id = ?', [key, req.academiaId]);
  res.json({ ok: true, logoUrl: `/logo/${req.academiaId}` });
}));

router.delete('/academia/logo', requireRole('admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT logo_key FROM academias WHERE id = ?', [req.academiaId]);
  const logoKey = rows[0]?.logo_key;
  await pool.query('UPDATE academias SET logo_key = NULL WHERE id = ?', [req.academiaId]);
  if (logoKey && r2Configurado()) {
    const s3 = getR2Client();
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: logoKey })).catch(() => {});
  }
  res.json({ ok: true });
}));

/* Autoatendimento da própria academia (não confundir com a rota igual
   que só o super-admin usa, em index.js) — o dono antecipa a assinatura
   da plataforma sem precisar esperar você mandar o link. */
router.post('/academia/stripe-checkout', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!stripeConfigurado() || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Cobrança não configurada — fale com o suporte.' });
  }
  const [rows] = await pool.query('SELECT id, nome, email, stripe_customer_id FROM academias WHERE id = ?', [req.academiaId]);
  const academia = rows[0];
  if (!academia) return res.status(404).json({ error: 'Academia não encontrada.' });

  const stripe = getStripeClient();
  let customerId = academia.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: academia.nome, email: academia.email });
    customerId = customer.id;
    await pool.query('UPDATE academias SET stripe_customer_id = ? WHERE id = ?', [customerId, academia.id]);
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/?assinatura=sucesso`,
    cancel_url: `${baseUrl}/?assinatura=cancelada`,
  });
  res.json({ ok: true, url: session.url });
}));

// Portal hospedado pelo próprio Stripe — trocar cartão, ver faturas,
// cancelar. Evita a gente lidar com dado de cartão diretamente.
router.post('/academia/stripe-portal', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!stripeConfigurado()) return res.status(503).json({ error: 'Cobrança não configurada — fale com o suporte.' });

  const [rows] = await pool.query('SELECT stripe_customer_id FROM academias WHERE id = ?', [req.academiaId]);
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: 'Você ainda não tem uma assinatura ativa — use "Antecipar assinatura" primeiro.' });

  const stripe = getStripeClient();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${baseUrl}/` });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    if (e.message && e.message.includes('configuration')) {
      return res.status(503).json({ error: 'O portal de cobrança ainda não foi configurado no Stripe — fale com o suporte.' });
    }
    throw e;
  }
}));

module.exports = router;
