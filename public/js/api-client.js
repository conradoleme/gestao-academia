/* ==========================================================================
   API CLIENT — chamadas à nossa própria API (Node/Express), com o token JWT
   guardado no localStorage.
   ========================================================================== */

const AUTH_TOKEN_KEY = 'academia_auth_token';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}
function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}
function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/* Decodifica o payload do JWT só para exibir dados (ex: e-mail) — não valida
   assinatura no cliente, isso é sempre responsabilidade da API. */
function decodeAuthToken() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearAuthToken();
    renderLoginScreen('Sua sessão expirou — faça login novamente.');
    throw new Error('Não autenticado.');
  }

  const body = await res.json().catch(() => ({}));
  // Trava otimista: outra tela/pessoa gravou antes, ou esta tela é de uma
  // versão antiga do sistema. Bloqueia com aviso em vez de sobrescrever.
  if (res.status === 409 && (body.code === 'VERSION_CONFLICT' || body.code === 'STALE_CLIENT')) {
    showConflictOverlay(body.error);
    const err = new Error(body.error);
    err.code = body.code;
    throw err;
  }
  if (!res.ok) throw new Error(body.error || `Erro na requisição (${res.status}).`);
  return body;
}

/* Gravações na mesma URL/chave rodam uma de cada vez: o autosave pode
   disparar um PUT antes do anterior voltar, e o segundo precisaria da
   versão nova que só o primeiro devolve — sem a fila ele brigaria consigo. */
const writeQueues = new Map();
function enqueueWrite(key, fn) {
  const prev = writeQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  writeQueues.set(key, next);
  const limpar = () => { if (writeQueues.get(key) === next) writeQueues.delete(key); };
  next.then(limpar, limpar);
  return next;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, data) => apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiFetch(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
  // PUT com trava: getBody() é lido só na hora de enviar (já com a versão
  // mais recente) e onVersion() guarda a versão nova devolvida pelo servidor.
  putLocked: (path, getBody, onVersion) => enqueueWrite(path, async () => {
    const r = await apiFetch(path, { method: 'PUT', body: JSON.stringify(getBody()) });
    if (r && r.version != null) onVersion(r.version);
    return r;
  }),
};
