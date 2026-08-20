/* ==========================================================================
   REDEFINIR SENHA — página isolada, acessada pelo link do e-mail de
   "esqueci minha senha". Não depende de api-client.js (sem sessão/token
   de app aqui) — faz fetch direto.
   ========================================================================== */

function getResetToken() {
  return new URLSearchParams(window.location.search).get('token');
}

async function resetFetch(path, data) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Erro na requisição.');
  return body;
}

function renderResetForm(token) {
  document.getElementById('reset-content').innerHTML = `
    <div class="form-group"><label>Nova senha</label><input type="password" id="reset-nova-senha" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
    <div class="form-group" style="margin-top:14px;"><label>Confirmar nova senha</label><input type="password" id="reset-confirmar-senha" autocomplete="new-password"></div>
    <div id="reset-error"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="handleResetPassword('${token}')">Criar Nova Senha</button>
  `;
  document.getElementById('reset-confirmar-senha').addEventListener('keydown', e => { if (e.key === 'Enter') handleResetPassword(token); });
}

function renderInvalidLink() {
  document.getElementById('reset-content').innerHTML = `
    <div class="alert alert-danger">Este link é inválido ou já foi usado. Peça um novo em "Esqueci minha senha" na tela de login.</div>
    <a href="index.html" class="btn btn-secondary" style="width:100%;text-align:center;display:block;margin-top:8px;">Voltar para o login</a>
  `;
}

function renderResetSuccess() {
  document.getElementById('reset-content').innerHTML = `
    <div class="alert alert-success">Senha alterada com sucesso!</div>
    <a href="index.html" class="btn btn-primary" style="width:100%;text-align:center;display:block;">Ir para o login</a>
  `;
}

async function handleResetPassword(token) {
  const novaSenha = document.getElementById('reset-nova-senha').value;
  const confirmar = document.getElementById('reset-confirmar-senha').value;
  const errorEl = document.getElementById('reset-error');
  errorEl.innerHTML = '';

  if (!novaSenha) { errorEl.innerHTML = `<div class="alert alert-danger">Informe a nova senha.</div>`; return; }
  if (novaSenha.length < 6) { errorEl.innerHTML = `<div class="alert alert-danger">A senha precisa ter pelo menos 6 caracteres.</div>`; return; }
  if (novaSenha !== confirmar) { errorEl.innerHTML = `<div class="alert alert-danger">A confirmação não bate com a nova senha.</div>`; return; }

  try {
    await resetFetch('/api/auth/reset-password', { token, novaSenha });
    renderResetSuccess();
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const token = getResetToken();
  if (!token) { renderInvalidLink(); return; }
  renderResetForm(token);
});
