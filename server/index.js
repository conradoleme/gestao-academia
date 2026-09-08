require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const migrate = require('./migrate');
const pool = require('./db');
const { requireAuth, requireRole, login, requireSuperAdmin, loginSuperAdmin } = require('./auth');
const { sendEmail } = require('./mailer');
const { runBackup } = require('./backup');
const { scheduleBackups } = require('./backup-scheduler');
const { r2Configurado, getR2Client } = require('./r2');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS, buildDefaultTransactions, DEFAULT_GRADUACAO_REGRAS_BJJ, DEFAULT_GRADUACAO_REGRAS_JUDO } = require('./seed-defaults');
const { logSafeError } = require('./log-safe-error');
const { generateUniqueSlug } = require('./slugify');
const { getStripeClient, stripeConfigurado } = require('./stripe-client');
const academiaRoutes = require('./routes/academia');
const studentsRoutes = require('./routes/students');
const turmasRoutes = require('./routes/turmas');
const transactionsRoutes = require('./routes/transactions');
const usuariosRoutes = require('./routes/usuarios');
const alunoRoutes = require('./routes/aluno');
const presencasRoutes = require('./routes/presencas');
const graduacoesRoutes = require('./routes/graduacoes');
const mensalidadesRoutes = require('./routes/mensalidades');
const recadosRoutes = require('./routes/recados');
const fichasMedicasRoutes = require('./routes/fichas-medicas');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway fica atrás de um proxy reverso — sem isso, todo mundo apareceria
// com o mesmo IP (o do proxy) pro rate limiter abaixo, e um limitaria todos.
app.set('trust proxy', 1);

// Frontend e API vivem na mesma origem (Railway serve os dois do mesmo
// domínio) — não existe motivo pra aceitar chamada de outro site. Em dev
// local (sem RAILWAY_PUBLIC_DOMAIN) libera geral pra não travar o trabalho.
// Domínio próprio (meutatameapp.com.br) e o domínio gerado pelo Railway
// (*.up.railway.app) ficam os dois ativos ao mesmo tempo — aceita ambos
// pra não quebrar quem ainda acessa pelo link antigo enquanto o DNS
// do domínio novo propaga.
const ALLOWED_ORIGINS = [
  process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
  'https://meutatameapp.com.br',
  'https://www.meutatameapp.com.br',
  'https://app-production-4551.up.railway.app',
].filter(Boolean);
const allowedOrigin = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true;
app.use(cors({ origin: allowedOrigin }));

/* ---------------- Webhook do Stripe (assinatura da PLATAFORMA — você
   cobrando cada academia pra usar o sistema; nada a ver com como a
   academia cobra os próprios alunos, isso continua manual). Precisa do
   corpo cru (não JSON-parseado) pra verificar a assinatura, então fica
   registrado antes do express.json() global — só essa rota recebe o
   corpo em Buffer, todo o resto do app usa JSON normalmente. ---------------- */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeConfigurado() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe não configurado.' });
  }
  const stripe = getStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    logSafeError('POST /webhooks/stripe (assinatura inválida)', e);
    return res.status(400).send('Assinatura inválida.');
  }

  try {
    const obj = event.data.object;
    const customerId = obj.customer;

    if (event.type === 'checkout.session.completed') {
      // O Customer já foi criado e salvo na academia ANTES do checkout (na
      // rota que gera o link) — aqui só completa com o ID da assinatura.
      await pool.query(
        'UPDATE academias SET stripe_subscription_id = ?, status_pagamento = ? WHERE stripe_customer_id = ?',
        [obj.subscription || null, 'ativo', customerId]
      );
    } else if (event.type === 'invoice.paid') {
      const periodEndUnix = obj.lines?.data?.[0]?.period?.end;
      const proximoVencimento = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString().slice(0, 10) : null;
      await pool.query(
        'UPDATE academias SET status_pagamento = ?, proximo_vencimento = COALESCE(?, proximo_vencimento) WHERE stripe_customer_id = ?',
        ['ativo', proximoVencimento, customerId]
      );
    } else if (event.type === 'invoice.payment_failed') {
      await pool.query('UPDATE academias SET status_pagamento = ? WHERE stripe_customer_id = ?', ['inadimplente', customerId]);
    } else if (event.type === 'customer.subscription.deleted') {
      await pool.query('UPDATE academias SET status_pagamento = ? WHERE stripe_customer_id = ?', ['inadimplente', customerId]);
    }
    res.json({ received: true });
  } catch (e) {
    logSafeError('POST /webhooks/stripe (processamento)', e);
    res.status(500).json({ error: 'Erro ao processar evento.' });
  }
});

app.use(express.json({ limit: '4mb' })); // acomoda a logo em base64 (upload de imagem)

/* ---------------- Healthcheck (Railway) ---------------- */
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

/* ---------------- Limite de tentativas nas rotas de login/senha ----------------
   Sem isso, login/esqueci-senha/redefinir-senha aceitavam tentativas
   ilimitadas — abre pra força bruta e credential stuffing. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas — aguarde alguns minutos e tente de novo.' },
});

/* ---------------- Logo da academia (pública — precisa carregar sem login) ----------------
   O bucket R2 continua privado: buscamos com nossas próprias credenciais e
   repassamos os bytes, em vez de expor o bucket publicamente. */
app.get('/logo/:academiaId', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT logo_key FROM academias WHERE id = ?', [req.params.academiaId]);
    const logoKey = rows[0]?.logo_key;
    if (!logoKey || !r2Configurado()) return res.status(404).end();

    const s3 = getR2Client();
    const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: logoKey }));
    res.set('Content-Type', obj.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    obj.Body.pipe(res);
  } catch (e) {
    res.status(404).end();
  }
});

/* ---------------- Login (única rota pública) ---------------- */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  try {
    const result = await login(email, senha);
    if (!result) return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    res.json(result);
  } catch (e) {
    logSafeError('POST /api/auth/login', e);
    res.status(500).json({ error: 'Erro ao autenticar.' });
  }
});

/* ---------------- Esqueci minha senha (rotas públicas) ---------------- */
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

  // Responde sempre a mesma coisa, exista ou não o e-mail — evita que alguém
  // use esse endpoint pra descobrir quais e-mails estão cadastrados.
  const mensagemPadrao = { ok: true, message: 'Se esse e-mail estiver cadastrado, enviamos um link de redefinição.' };

  try {
    const [aRows] = await pool.query('SELECT nome FROM academias WHERE email = ?', [email]);
    const [uRows] = await pool.query('SELECT nome FROM usuarios WHERE email = ?', [email]);
    const encontrado = aRows[0] || uRows[0];

    if (encontrado) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await pool.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?,?,?)', [email, token, expiresAt]);

      const resetUrl = `${req.protocol}://${req.get('host')}/reset-senha.html?token=${token}`;
      await sendEmail({
        to: email,
        subject: 'Redefinir senha — Gestão de Academia',
        html: `
          <p>Oi ${encontrado.nome ? encontrado.nome : ''},</p>
          <p>Alguém (esperamos que você) pediu pra redefinir a senha da sua conta. Clique no link abaixo pra criar uma senha nova — ele expira em 1 hora:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
        `,
      });
    }
  } catch (e) {
    logSafeError('POST /api/auth/forgot-password', e);
  }

  res.json(mensagemPadrao);
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token, novaSenha } = req.body || {};
  if (!token || !novaSenha) return res.status(400).json({ error: 'Dados incompletos.' });
  if (novaSenha.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Link inválido ou expirado. Peça um novo link de redefinição.' });

    const { email } = rows[0];
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    const [aRows] = await pool.query('SELECT id FROM academias WHERE email = ?', [email]);
    if (aRows[0]) {
      await pool.query('UPDATE academias SET senha_hash = ? WHERE id = ?', [senhaHash, aRows[0].id]);
    } else {
      const [uRows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (!uRows[0]) return res.status(400).json({ error: 'Conta não encontrada.' });
      await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, uRows[0].id]);
    }

    await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);
    res.json({ ok: true });
  } catch (e) {
    logSafeError('POST /api/auth/reset-password', e);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

/* ---------------- Painel de admin (login próprio, fora do multi-tenant) ---------------- */
app.post('/admin/auth/login', authLimiter, async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  try {
    const result = await loginSuperAdmin(email, senha);
    if (!result) return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    res.json(result);
  } catch (e) {
    logSafeError('POST /admin/auth/login', e);
    res.status(500).json({ error: 'Erro ao autenticar.' });
  }
});

app.put('/admin/auth/senha', requireSuperAdmin, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  if (novaSenha.length < 8) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  try {
    const [rows] = await pool.query('SELECT senha_hash FROM super_admins WHERE id = ?', [req.superAdminId]);
    if (!rows[0]) return res.status(404).json({ error: 'Conta não encontrada.' });
    const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
    if (!ok) return res.status(400).json({ error: 'Senha atual incorreta.' });
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await pool.query('UPDATE super_admins SET senha_hash = ? WHERE id = ?', [novoHash, req.superAdminId]);
    res.json({ ok: true });
  } catch (e) {
    logSafeError('PUT /admin/auth/senha', e);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

// Modalidade só decide o ponto de partida (faixas pré-carregadas + se o
// campo "Grau" aparece) — depois de criada, a academia edita tudo livre
// em Configurações, igual sempre foi possível pro BJJ.
const MODALIDADE_TEMPLATES = {
  bjj: { graduacaoRegras: DEFAULT_GRADUACAO_REGRAS_BJJ, usaGrau: true },
  judo: { graduacaoRegras: DEFAULT_GRADUACAO_REGRAS_JUDO, usaGrau: false },
  outro: { graduacaoRegras: {}, usaGrau: true },
};

app.post('/admin/create-academia', requireSuperAdmin, async (req, res) => {
  const { email, senha, nome, turmasPadrao, modalidade, trialDias } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

  try {
    const [existing] = await pool.query('SELECT id FROM academias WHERE email = ?', [email]);
    if (existing[0]) return res.status(409).json({ error: 'Já existe uma academia com esse e-mail.' });

    const modalidadeSalva = MODALIDADE_TEMPLATES[modalidade] ? modalidade : 'bjj';
    const template = MODALIDADE_TEMPLATES[modalidadeSalva];
    const senhaHash = await bcrypt.hash(senha, 10);
    const slug = await generateUniqueSlug(pool, nome || 'Minha Academia');
    const dias = Number(trialDias) > 0 ? Number(trialDias) : 14;
    const [result] = await pool.query(
      `INSERT INTO academias (email, senha_hash, nome, slug, usa_grau, generated_months, category_groups, cobranca_templates, graduacao_regras, trial_ends_at, modalidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)`,
      [email, senhaHash, nome || 'Minha Academia', slug, template.usaGrau ? 1 : 0, JSON.stringify([]), JSON.stringify(DEFAULT_CATEGORY_GROUPS), JSON.stringify(DEFAULT_COBRANCA_TEMPLATES), JSON.stringify(template.graduacaoRegras), dias, modalidadeSalva]
    );

    if (turmasPadrao) {
      for (const t of DEFAULT_TURMAS) {
        await pool.query(
          `INSERT INTO turmas (academia_id, nome, horarios, freq_anterior, freq_atual) VALUES (?,?,?,?,?)`,
          [result.insertId, t.nome, JSON.stringify(t.horarios), t.freqAnterior, t.freqAtual]
        );
      }
    }

    for (const tx of buildDefaultTransactions()) {
      await pool.query(
        `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, origem, recorrente)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [result.insertId, tx.data, tx.grupo, tx.categoria, tx.descricao, tx.valor, tx.status, tx.tipo, tx.origem, tx.recorrente ? 1 : 0]
      );
    }

    res.json({ ok: true, id: result.insertId, email });
  } catch (e) {
    logSafeError('POST /admin/create-academia', e);
    res.status(500).json({ error: 'Erro ao criar academia.' });
  }
});

app.get('/admin/academias', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.nome, a.email, a.status_pagamento, a.valor_mensal, a.proximo_vencimento, a.created_at, a.stripe_subscription_id,
        (SELECT COUNT(*) FROM students WHERE academia_id = a.id) AS total_alunos,
        (SELECT COUNT(*) FROM turmas WHERE academia_id = a.id) AS total_turmas
      FROM academias a ORDER BY a.created_at DESC
    `);
    res.json(rows.map(r => ({
      id: r.id, nome: r.nome, email: r.email,
      statusPagamento: r.status_pagamento, valorMensal: Number(r.valor_mensal) || 0,
      proximoVencimento: r.proximo_vencimento, createdAt: r.created_at,
      totalAlunos: r.total_alunos, totalTurmas: r.total_turmas,
      stripeAtivo: !!r.stripe_subscription_id,
    })));
  } catch (e) {
    logSafeError('GET /admin/academias', e);
    res.status(500).json({ error: 'Erro ao listar academias.' });
  }
});

app.put('/admin/academias/:id/pagamento', requireSuperAdmin, async (req, res) => {
  const { statusPagamento, valorMensal, proximoVencimento } = req.body || {};
  const statusesValidos = ['ativo', 'pendente', 'inadimplente'];
  if (statusPagamento && !statusesValidos.includes(statusPagamento)) {
    return res.status(400).json({ error: 'Status de pagamento inválido.' });
  }
  try {
    await pool.query(
      `UPDATE academias SET status_pagamento = ?, valor_mensal = ?, proximo_vencimento = ? WHERE id = ?`,
      [statusPagamento || 'ativo', valorMensal || 0, proximoVencimento || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    logSafeError('PUT /admin/academias/:id/pagamento', e);
    res.status(500).json({ error: 'Erro ao atualizar pagamento.' });
  }
});

// Gera o link de pagamento (Stripe Checkout) da ASSINATURA DA PLATAFORMA
// pra essa academia — você manda esse link pro dono da academia pagar.
// Reaproveita o mesmo Customer do Stripe se a academia já tiver um (ex:
// segunda cobrança depois de cancelar), em vez de criar um novo à toa.
app.post('/admin/academias/:id/stripe-checkout', requireSuperAdmin, async (req, res) => {
  if (!stripeConfigurado() || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Stripe não configurado (falta STRIPE_SECRET_KEY ou STRIPE_PRICE_ID).' });
  }
  try {
    const [rows] = await pool.query('SELECT id, nome, email, stripe_customer_id FROM academias WHERE id = ?', [req.params.id]);
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
      success_url: `${baseUrl}/admin.html?stripe=sucesso`,
      cancel_url: `${baseUrl}/admin.html?stripe=cancelado`,
    });

    res.json({ ok: true, url: session.url });
  } catch (e) {
    logSafeError('POST /admin/academias/:id/stripe-checkout', e);
    res.status(500).json({ error: 'Erro ao gerar cobrança no Stripe.' });
  }
});

app.put('/admin/academias/:id/senha', requireSuperAdmin, async (req, res) => {
  const { novaSenha } = req.body || {};
  if (!novaSenha || novaSenha.length < 8) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  }
  try {
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await pool.query('UPDATE academias SET senha_hash = ? WHERE id = ?', [novoHash, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logSafeError('PUT /admin/academias/:id/senha', e);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

// Dispara um backup imediatamente — pra testar a configuração sem esperar
// o horário agendado (server/backup-scheduler.js).
app.post('/admin/backup-now', requireSuperAdmin, async (req, res) => {
  const result = await runBackup();
  res.status(result.ok ? 200 : 500).json(result);
});

app.delete('/admin/academias/:id', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM academias WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logSafeError('DELETE /admin/academias/:id', e);
    res.status(500).json({ error: 'Erro ao excluir academia.' });
  }
});

/* Landing "de marca" por academia (ex: meutatameapp.com.br/goushibjj) —
   pública de propósito, só devolve nome e logo (nada sensível) pra
   personalizar a tela de login antes mesmo do aluno digitar o e-mail. */
app.get('/api/academia-by-slug/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nome, logo_key FROM academias WHERE slug = ?', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
    const r = rows[0];
    res.json({ nome: r.nome, logoUrl: r.logo_key ? `/logo/${r.id}` : null });
  } catch (e) {
    logSafeError('GET /api/academia-by-slug/:slug', e);
    res.status(500).json({ error: 'Erro ao buscar academia.' });
  }
});

/* ---------------- A partir daqui, exige token ---------------- */
app.use('/api', requireAuth);

/* Portal do aluno (role 'aluno') — só enxerga seus próprios dados, nunca a
   academia inteira. Montado antes do bloqueio de papel abaixo. */
app.use('/api/aluno', alunoRoutes);

/* Daqui pra baixo é a área "de gestão": dono (admin) e equipe (operação). */
app.use('/api', requireRole('admin', 'operacao'));
app.use('/api', academiaRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/presencas', presencasRoutes);
app.use('/api/graduacoes', graduacoesRoutes);
app.use('/api/mensalidades', mensalidadesRoutes);
app.use('/api/recados', recadosRoutes);
app.use('/api/fichas-medicas', fichasMedicasRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));

/* ---------------- Frontend estático ---------------- */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* ---------------- Rede de segurança — qualquer erro não tratado cai aqui,
   em vez de derrubar o processo ou vazar stack trace pro cliente. ---------------- */
app.use((err, req, res, next) => {
  logSafeError(`${req.method} ${req.path}`, err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

migrate()
  .then(() => {
    scheduleBackups();
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch(err => {
    console.error('Erro ao aplicar o schema no boot:', err.message);
    process.exit(1);
  });
