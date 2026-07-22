require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const migrate = require('./migrate');
const pool = require('./db');
const { requireAuth, login } = require('./auth');
const { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS, buildDefaultTransactions } = require('./seed-defaults');
const academiaRoutes = require('./routes/academia');
const studentsRoutes = require('./routes/students');
const turmasRoutes = require('./routes/turmas');
const transactionsRoutes = require('./routes/transactions');

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
app.use('/api', academiaRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));

/* ---------------- Frontend estático ---------------- */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch(err => {
    console.error('Erro ao aplicar o schema no boot:', err.message);
    process.exit(1);
  });
