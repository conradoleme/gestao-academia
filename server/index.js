require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const migrate = require('./migrate');
const pool = require('./db');
const { requireAuth, requireRole, login } = require('./auth');
const { sendEmail } = require('./mailer');
const { runBackup } = require('./backup');
const { scheduleBackups } = require('./backup-scheduler');
const { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS, buildDefaultTransactions } = require('./seed-defaults');
const academiaRoutes = require('./routes/academia');
const studentsRoutes = require('./routes/students');
const turmasRoutes = require('./routes/turmas');
const transactionsRoutes = require('./routes/transactions');
const usuariosRoutes = require('./routes/usuarios');
const alunoRoutes = require('./routes/aluno');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ---------------- Healthcheck (Railway) ---------------- */
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

/* ---------------- Login (única rota pública) ---------------- */
app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  try {
    const result = await login(email, senha);
    if (!result) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao autenticar.' });
  }
});

/* ---------------- Esqueci minha senha (rotas públicas) ---------------- */
app.post('/api/auth/forgot-password', async (req, res) => {
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
    console.error(e);
  }

  res.json(mensagemPadrao);
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, novaSenha } = req.body || {};
  if (!token || !novaSenha) return res.status(400).json({ error: 'Dados incompletos.' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

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
    console.error(e);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

/* ---------------- Painel de admin (só eu, com a chave de admin) ---------------- */
function requireAdminKey(req, res, next) {
  if (!process.env.ADMIN_SETUP_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_SETUP_KEY) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

app.post('/admin/create-academia', requireAdminKey, async (req, res) => {
  const { email, senha, nome, turmasPadrao } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

  try {
    const [existing] = await pool.query('SELECT id FROM academias WHERE email = ?', [email]);
    if (existing[0]) return res.status(409).json({ error: 'Já existe uma academia com esse e-mail.' });

    const senhaHash = await bcrypt.hash(senha, 10);
    const [result] = await pool.query(
      `INSERT INTO academias (email, senha_hash, nome, generated_months, category_groups, cobranca_templates)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, senhaHash, nome || 'Minha Academia', JSON.stringify([]), JSON.stringify(DEFAULT_CATEGORY_GROUPS), JSON.stringify(DEFAULT_COBRANCA_TEMPLATES)]
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
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar academia.' });
  }
});

app.get('/admin/academias', requireAdminKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.nome, a.email, a.status_pagamento, a.valor_mensal, a.proximo_vencimento, a.created_at,
        (SELECT COUNT(*) FROM students WHERE academia_id = a.id) AS total_alunos,
        (SELECT COUNT(*) FROM turmas WHERE academia_id = a.id) AS total_turmas
      FROM academias a ORDER BY a.created_at DESC
    `);
    res.json(rows.map(r => ({
      id: r.id, nome: r.nome, email: r.email,
      statusPagamento: r.status_pagamento, valorMensal: Number(r.valor_mensal) || 0,
      proximoVencimento: r.proximo_vencimento, createdAt: r.created_at,
      totalAlunos: r.total_alunos, totalTurmas: r.total_turmas,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar academias.' });
  }
});

app.put('/admin/academias/:id/pagamento', requireAdminKey, async (req, res) => {
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
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar pagamento.' });
  }
});

app.put('/admin/academias/:id/senha', requireAdminKey, async (req, res) => {
  const { novaSenha } = req.body || {};
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  }
  try {
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await pool.query('UPDATE academias SET senha_hash = ? WHERE id = ?', [novoHash, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

// Dispara um backup imediatamente — pra testar a configuração sem esperar
// o horário agendado (server/backup-scheduler.js).
app.post('/admin/backup-now', requireAdminKey, async (req, res) => {
  const result = await runBackup();
  res.status(result.ok ? 200 : 500).json(result);
});

app.delete('/admin/academias/:id', requireAdminKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM academias WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao excluir academia.' });
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
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));

/* ---------------- Frontend estático ---------------- */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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
