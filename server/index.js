require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const { requireAuth, login } = require('./auth');
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

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
