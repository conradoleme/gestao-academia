require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const migrate = require('./migrate');
const pool = require('./db');
const { requireAuth, login } = require('./auth');
const { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS } = require('./seed-defaults');
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

/* ---------------- Provisionamento (só eu, com a chave de admin) ---------------- */
app.post('/admin/create-academia', async (req, res) => {
  if (!process.env.ADMIN_SETUP_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_SETUP_KEY) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
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

    res.json({ ok: true, id: result.insertId, email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar academia.' });
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
