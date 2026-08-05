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
    req.role = payload.role;
    req.userId = payload.userId || null;
    req.alunoId = payload.alunoId || null;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada — faça login novamente.' });
  }
}

/* Só permite seguir se o papel do token estiver entre os informados. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) return res.status(403).json({ error: 'Sem permissão para essa ação.' });
    next();
  };
}

/* Um login = uma linha em "academias" (dono/admin) OU em "usuarios"
   (operação/aluno, vinculados a uma academia). Tentamos academias primeiro
   porque é o caso mais comum. */
async function login(email, senha) {
  const [aRows] = await pool.query('SELECT * FROM academias WHERE email = ?', [email]);
  if (aRows[0]) {
    const academia = aRows[0];
    const ok = await bcrypt.compare(senha, academia.senha_hash);
    if (!ok) return null;
    const token = jwt.sign({ academiaId: academia.id, email: academia.email, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    return { token, nome: academia.nome, role: 'admin' };
  }

  const [uRows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  if (uRows[0]) {
    const usuario = uRows[0];
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return null;
    const token = jwt.sign(
      { academiaId: usuario.academia_id, email: usuario.email, role: usuario.role, userId: usuario.id, alunoId: usuario.aluno_id },
      JWT_SECRET, { expiresIn: '30d' }
    );
    return { token, nome: usuario.nome, role: usuario.role };
  }

  return null;
}

module.exports = { requireAuth, requireRole, login, JWT_SECRET };
