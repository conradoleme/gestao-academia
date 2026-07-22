/* Autenticação própria: 1 login = 1 academia. JWT emitido no login,
   verificado em todas as rotas de /api (exceto /api/auth/login). */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.academiaId = payload.academiaId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada — faça login novamente.' });
  }
}

async function login(email, senha) {
  const [rows] = await pool.query('SELECT * FROM academias WHERE email = ?', [email]);
  const academia = rows[0];
  if (!academia) return null;
  const ok = await bcrypt.compare(senha, academia.senha_hash);
  if (!ok) return null;
  const token = jwt.sign({ academiaId: academia.id, email: academia.email }, JWT_SECRET, { expiresIn: '30d' });
  return { token, nome: academia.nome };
}

module.exports = { requireAuth, login, JWT_SECRET };
