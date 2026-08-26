/* ==========================================================================
   AUTH — login/logout por academia (autenticação própria via JWT)
   ========================================================================== */

/* Se a URL bater um link de marca (ex: /goushibjj), cacheia o nome/logo
   daquela academia pra a tela de login (e uma eventual sessão expirada
   depois) mostrar a cara dela em vez do branding genérico. */
let cachedSlugBranding = null;

function getSlugFromPath() {
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  return seg || null;
}

async function resolveSlugBranding() {
  const slug = getSlugFromPath();
  if (!slug) return null;
  try {
    cachedSlugBranding = await api.get('/api/academia-by-slug/' + encodeURIComponent(slug));
  } catch (e) {
    cachedSlugBranding = null;
  }
  return cachedSlugBranding;
}

function renderLoginScreen(errorMsg, branding) {
  const b = branding !== undefined ? branding : cachedSlugBranding;
  const el = document.getElementById('login-screen');
  const logoHtml = b?.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" style="height:28px;vertical-align:middle;border-radius:6px;">`
    : '🥋';
  el.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="logo" style="margin-bottom:6px;">${logoHtml} ${b ? escapeHtml(b.nome) : `Gestão <span>da Academia</span>`}</div>
        <p class="subtitle" style="margin-bottom:28px;">Entre com email e senha</p>
        ${errorMsg ? `<div class="alert alert-danger">${escapeHtml(errorMsg)}</div>` : ''}
        <div class="form-group"><label>E-mail</label><input type="email" id="login-email" class="login-input" placeholder="voce@academia.com"></div>
        <div class="form-group" style="margin-top:18px;"><label>Senha</label><input type="password" id="login-senha" class="login-input" placeholder="••••••••"></div>
        <button class="btn btn-primary login-submit" style="width:100%;margin-top:26px;" onclick="handleLogin()">Entrar</button>
        <div style="text-align:center;margin-top:18px;">
          <a href="#" style="font-size:13px;color:var(--text2);" onclick="openForgotPasswordModal();return false;">Esqueci minha senha</a>
        </div>
      </div>
    </div>
  `;
  const senhaInput = document.getElementById('login-senha');
  senhaInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-screen').style.display = 'block';
  document.querySelector('.app').style.display = 'none';
}

function hideLoginScreen() {
  document.getElementById('login-screen').style.display = 'none';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) { renderLoginScreen('Preencha e-mail e senha.'); return; }

  try {
    const result = await api.post('/api/auth/login', { email, senha });
    setAuthToken(result.token);
    hideLoginScreen();
    await bootByRole();
  } catch (e) {
    renderLoginScreen(e.message || 'Não foi possível entrar.');
  }
}

function openForgotPasswordModal() {
  openModal('Esqueci minha senha', `
    <p style="color:var(--text2);font-size:13px;margin-bottom:16px;">Informe o e-mail da sua conta — se ele estiver cadastrado, enviamos um link pra você criar uma senha nova.</p>
    <div class="form-group"><label>E-mail</label><input type="email" id="forgot-email" placeholder="voce@academia.com"></div>
    <div id="forgot-result"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" id="forgot-submit-btn" onclick="handleForgotPassword()">Enviar Link</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '420px' });
}

async function handleForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const resultEl = document.getElementById('forgot-result');
  resultEl.innerHTML = '';
  if (!email) { resultEl.innerHTML = `<div class="alert alert-danger">Informe o e-mail.</div>`; return; }

  const btn = document.getElementById('forgot-submit-btn');
  btn.disabled = true;
  try {
    const result = await api.post('/api/auth/forgot-password', { email });
    resultEl.innerHTML = `<div class="alert alert-success">${escapeHtml(result.message)}</div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
    btn.disabled = false;
  }
}

function handleLogout() {
  clearAuthToken();
  location.reload();
}

/* Aluno tem uma experiência própria (portal restrito); admin/operação
   entram no app de gestão completo (com restrições de menu pra operação,
   ver applyRoleUI em main.js). */
async function bootByRole() {
  const role = decodeAuthToken()?.role;
  if (role === 'aluno') {
    await bootAlunoPortal();
  } else {
    document.querySelector('.app').style.display = 'grid';
    await bootAppAfterLogin();
  }
}

async function checkExistingSession() {
  if (!getAuthToken()) {
    await resolveSlugBranding();
    renderLoginScreen();
    return false;
  }
  hideLoginScreen();
  return true;
}
