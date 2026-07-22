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
  if (!res.ok) throw new Error(body.error || `Erro na requisição (${res.status}).`);
  return body;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, data) => apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiFetch(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
};
