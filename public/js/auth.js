/* ==========================================================================
   AUTH — login/logout por academia (autenticação própria via JWT)
   ========================================================================== */

function renderLoginScreen(errorMsg) {
  const el = document.getElementById('login-screen');
  el.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="logo" style="margin-bottom:2px;">🥋 Gestão <span>da Academia</span></div>
        <p class="subtitle" style="margin-bottom:24px;">Entre com o e-mail e senha da sua academia</p>
        ${errorMsg ? `<div class="alert alert-danger">${escapeHtml(errorMsg)}</div>` : ''}
        <div class="form-group"><label>E-mail</label><input type="email" id="login-email" placeholder="voce@academia.com"></div>
        <div class="form-group" style="margin-top:14px;"><label>Senha</label><input type="password" id="login-senha" placeholder="••••••••"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="handleLogin()">Entrar</button>
        <div style="text-align:center;margin-top:14px;">
          <a href="#" style="font-size:12.5px;color:var(--text2);" onclick="openForgotPasswordModal();return false;">Esqueci minha senha</a>
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
  if (!getAuthToken()) { renderLoginScreen(); return false; }
  hideLoginScreen();
  return true;
}
