const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('../db');
const { studentToJSON, turmaToJSON, txToJSON, academiaToShape, presencaToJSON, graduacaoToJSON, recadoToJSON } = require('../mappers');
const { requireRole } = require('../auth');
const { r2Configurado, getR2Client } = require('../r2');
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

router.put('/academia', asyncHandler(async (req, res) => {
  const { meta, categoryGroups, cobrancaTemplates, graduacaoRegras } = req.body;
  await pool.query(
    `UPDATE academias SET nome=?, tatame_comprimento=?, tatame_largura=?, concentracao_pico=?, generated_months=?, category_groups=?, cobranca_templates=?, watermark_ativo=?, graduacao_regras=?
     WHERE id=?`,
    [meta.empresa, meta.tatame.comprimento, meta.tatame.largura, meta.concentracaoPico,
     JSON.stringify(meta.generatedMonths || []), JSON.stringify(categoryGroups || {}), JSON.stringify(cobrancaTemplates || []),
     meta.watermarkAtivo ? 1 : 0, JSON.stringify(graduacaoRegras || {}), req.academiaId]
  );
  res.json({ ok: true });
}));

router.put('/academia/senha', asyncHandler(async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });

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

module.exports = router;
