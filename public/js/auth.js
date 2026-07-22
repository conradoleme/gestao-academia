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
  document.querySelector('.app').style.display = 'grid';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) { renderLoginScreen('Preencha e-mail e senha.'); return; }

  try {
    const result = await api.post('/api/auth/login', { email, senha });
    setAuthToken(result.token);
    hideLoginScreen();
    await bootAppAfterLogin();
  } catch (e) {
    renderLoginScreen(e.message || 'Não foi possível entrar.');
  }
}

function handleLogout() {
  clearAuthToken();
  location.reload();
}

async function checkExistingSession() {
  if (!getAuthToken()) { renderLoginScreen(); return false; }
  hideLoginScreen();
  return true;
}
