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
      <div style="font-size:13px;color:var(--text2);">Login: <strong style="color:var(--text);">${escapeHtml(email)}</strong></div>
    </div>
  `;
}

async function handleSaveAcademiaNome() {
  const nome = document.getElementById('cfg-nome-academia').value.trim();
  if (!nome) { showToast('Informe o nome da academia.', 'error'); return; }
  await updateAcademiaNome(nome);
  document.getElementById('app-empresa-nome').textContent = nome;
  document.getElementById('app-empresa-nome-mobile').textContent = nome;
  showToast('Nome da academia atualizado!');
}
