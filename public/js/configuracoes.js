/* ==========================================================================
   CONFIGURAÇÕES — dados da academia logada (nome, conta)
   ========================================================================== */

function renderConfiguracoesPage() {
  const email = decodeAuthToken()?.email || '—';

  document.getElementById('page-configuracoes').innerHTML = `
    <div class="section-header">
      <div><h1>Configurações</h1><p class="subtitle" style="margin:0;">Dados da sua academia</p></div>
    </div>

    <div class="card" style="max-width:520px;">
      <h3>Academia</h3>
      <div class="form-group">
        <label>Nome da Academia</label>
        <input type="text" id="cfg-nome-academia" value="${escapeHtml(data.meta.empresa)}">
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="handleSaveAcademiaNome()">Salvar</button>
      </div>

      <hr class="divider">

      <h3>Conta</h3>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px;">Login: <strong style="color:var(--text);">${escapeHtml(email)}</strong></div>

      <div class="form-group">
        <label>Senha atual</label>
        <input type="password" id="cfg-senha-atual" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label>Nova senha</label>
        <input type="password" id="cfg-senha-nova" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label>Confirmar nova senha</label>
        <input type="password" id="cfg-senha-confirmar" autocomplete="new-password">
      </div>
      <div id="cfg-senha-error"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="handleChangeSenha()">Trocar Senha</button>
      </div>
    </div>
  `;
}

async function handleChangeSenha() {
  const senhaAtual = document.getElementById('cfg-senha-atual').value;
  const novaSenha = document.getElementById('cfg-senha-nova').value;
  const confirmar = document.getElementById('cfg-senha-confirmar').value;
  const errorEl = document.getElementById('cfg-senha-error');
  errorEl.innerHTML = '';

  if (!senhaAtual || !novaSenha) { errorEl.innerHTML = `<div class="alert alert-danger">Preencha a senha atual e a nova senha.</div>`; return; }
  if (novaSenha.length < 6) { errorEl.innerHTML = `<div class="alert alert-danger">A nova senha precisa ter pelo menos 6 caracteres.</div>`; return; }
  if (novaSenha !== confirmar) { errorEl.innerHTML = `<div class="alert alert-danger">A confirmação não bate com a nova senha.</div>`; return; }

  try {
    await changeAcademiaSenha(senhaAtual, novaSenha);
    document.getElementById('cfg-senha-atual').value = '';
    document.getElementById('cfg-senha-nova').value = '';
    document.getElementById('cfg-senha-confirmar').value = '';
    showToast('Senha alterada com sucesso!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

async function handleSaveAcademiaNome() {
  const nome = document.getElementById('cfg-nome-academia').value.trim();
  if (!nome) { showToast('Informe o nome da academia.', 'error'); return; }
  await updateAcademiaNome(nome);
  document.getElementById('app-empresa-nome').textContent = nome;
  document.getElementById('app-empresa-nome-mobile').textContent = nome;
  showToast('Nome da academia atualizado!');
}
