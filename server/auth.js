/* Autenticação própria: 1 login = 1 academia. JWT emitido no login,
   verificado em todas as rotas de /api (exceto /api/auth/login). */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado — defina a variável de ambiente antes de subir o servidor.');
}

/* O token vale 30 dias, mas quem manda é o banco: a cada requisição confirmamos
   que o usuário (ou a academia) ainda existe e usamos o papel ATUAL dele — assim
   remover ou rebaixar alguém corta o acesso na hora, sem esperar o token expirar.
   Cache curto só pra não somar uma consulta em toda chamada. */
const SESSAO_TTL_MS = 10 * 1000;
const sessaoCache = new Map();

function invalidarSessoes() { sessaoCache.clear(); }

async function sessaoAtual(payload) {
  const chave = payload.userId ? `u:${payload.userId}` : `a:${payload.academiaId}`;
  const hit = sessaoCache.get(chave);
  if (hit && hit.exp > Date.now()) return hit.dados;

  let dados = null;
  if (payload.userId) {
    const [rows] = await pool.query('SELECT role, aluno_id, academia_id FROM usuarios WHERE id = ?', [payload.userId]);
    if (rows[0] && rows[0].academia_id === payload.academiaId) {
      dados = { role: rows[0].role, alunoId: rows[0].aluno_id || null };
    }
  } else {
    const [rows] = await pool.query('SELECT id FROM academias WHERE id = ?', [payload.academiaId]);
    if (rows[0]) dados = { role: 'admin', alunoId: null };
  }
  if (sessaoCache.size > 5000) sessaoCache.clear();
  if (dados) sessaoCache.set(chave, { dados, exp: Date.now() + SESSAO_TTL_MS });
  return dados;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada — faça login novamente.' });
  }
  // Um token de super-admin (sem academiaId) não é um login de tenant —
  // rejeita aqui em vez de deixar academia_id=undefined vazar pras queries.
  if (!payload.academiaId) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const sessao = await sessaoAtual(payload);
    if (!sessao) return res.status(401).json({ error: 'Sessão expirada — faça login novamente.' });
    req.academiaId = payload.academiaId;
    req.role = sessao.role;
    req.userId = payload.userId || null;
    req.alunoId = sessao.alunoId;
    next();
  } catch (e) {
    next(e);
  }
}

/* Painel super-admin (fora do multi-tenant — gerencia as academias em si).
   Token próprio, marcado com superAdmin:true, pra nunca ser confundido
   com um JWT de academia/usuário/aluno. */
function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload.superAdmin) return res.status(403).json({ error: 'Sem permissão para essa ação.' });
    req.superAdminId = payload.superAdminId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada — faça login novamente.' });
  }
}

async function loginSuperAdmin(email, senha) {
  const [rows] = await pool.query('SELECT * FROM super_admins WHERE email = ?', [email]);
  if (!rows[0]) return null;
  const ok = await bcrypt.compare(senha, rows[0].senha_hash);
  if (!ok) return null;
  const token = jwt.sign({ superAdminId: rows[0].id, email: rows[0].email, superAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
  return { token };
}

/* Só permite seguir se o papel do token estiver entre os informados. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) return res.status(403).json({ error: 'Sem permissão para essa ação.' });
    next();
  };
}

/* Dono = a linha em "academias" (token sem userId). Admins adicionais moram em
   "usuarios" com role 'admin' e têm userId no token — enxergam o mesmo que o
   dono, mas não gerenciam acessos nem a assinatura da plataforma. */
function requireOwner(req, res, next) {
  if (req.role !== 'admin' || req.userId) return res.status(403).json({ error: 'Só o dono da academia pode fazer isso.' });
  next();
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

module.exports = { invalidarSessoes, requireAuth, requireRole, requireOwner, login, requireSuperAdmin, loginSuperAdmin, JWT_SECRET };
