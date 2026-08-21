/* ==========================================================================
   CONFIGURAÇÕES — dados da academia logada (nome, conta) e, para o dono
   (role 'admin'), gestão dos acessos de equipe (operação) e alunos.
   ========================================================================== */

let usuariosCache = [];

const ROLE_LABELS = { admin: 'Dono', operacao: 'Operação', aluno: 'Aluno' };

async function renderConfiguracoesPage() {
  const email = decodeAuthToken()?.email || '—';
  const role = decodeAuthToken()?.role;
  const isAdmin = role === 'admin';

  if (isAdmin) {
    try { usuariosCache = await fetchUsuarios(); } catch (e) { usuariosCache = []; }
  }

  document.getElementById('page-configuracoes').innerHTML = `
    <div class="section-header">
      <div><h1>Configurações</h1><p class="subtitle" style="margin:0;">Dados da sua academia</p></div>
    </div>

    <div class="card" style="max-width:520px;margin-bottom:24px;">
      <h3>Academia</h3>
      <div class="form-group">
        <label>Nome da Academia</label>
        <input type="text" id="cfg-nome-academia" value="${escapeHtml(data.meta.empresa)}">
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="handleSaveAcademiaNome()">Salvar</button>
      </div>

      <hr class="divider">

      <h3>Logo da Academia</h3>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div id="cfg-logo-preview" style="width:56px;height:56px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          ${data.meta.logoUrl ? `<img src="${escapeHtml(data.meta.logoUrl)}" style="width:100%;height:100%;object-fit:contain;">` : `<span style="font-size:26px;">🥋</span>`}
        </div>
        <div style="font-size:12.5px;color:var(--text2);">PNG, JPG, WEBP ou SVG · até 2MB<br>Aparece no menu lateral do sistema.</div>
      </div>
      <div class="form-group">
        <input type="file" id="cfg-logo-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="handleLogoFileSelected()">
      </div>
      <div id="cfg-logo-error"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="cfg-logo-upload-btn" onclick="handleUploadLogo()" disabled>Enviar Logo</button>
        ${data.meta.logoUrl ? `<button class="btn btn-secondary" onclick="handleRemoveLogo()">Remover Logo</button>` : ''}
      </div>

      ${data.meta.logoUrl ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:14px;">
          <input type="checkbox" id="cfg-watermark-ativo" style="width:auto;" ${data.meta.watermarkAtivo ? 'checked' : ''} onchange="handleToggleWatermark()">
          <label style="margin:0;">Usar como marca d'água no fundo do sistema</label>
        </div>
      ` : ''}

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

    ${isAdmin ? `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h3 style="margin:0;">Usuários</h3>
            <p style="color:var(--text2);font-size:12.5px;margin:4px 0 0;">Acessos de equipe (operação) e de alunos, além do seu login de dono.</p>
          </div>
          <button class="btn btn-primary" onclick="openUsuarioForm()">+ Novo Usuário</button>
        </div>
        <div class="table-wrap table-responsive-cards">
          <table>
            <thead><tr>
              <th style="text-align:left;">Nome</th><th style="text-align:left;">E-mail</th><th>Papel</th><th style="text-align:left;">Vínculo</th><th>Ações</th>
            </tr></thead>
            <tbody>${usuariosCache.map(usuarioRow).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--text2);">Nenhum usuário adicional cadastrado ainda.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    ` : ''}
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

/* ---------------- Logo da Academia ---------------- */
let logoSelecionadaBase64 = null;

function handleLogoFileSelected() {
  const input = document.getElementById('cfg-logo-input');
  const errorEl = document.getElementById('cfg-logo-error');
  errorEl.innerHTML = '';
  logoSelecionadaBase64 = null;
  document.getElementById('cfg-logo-upload-btn').disabled = true;

  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    errorEl.innerHTML = `<div class="alert alert-danger">Imagem muito grande — máximo 2MB.</div>`;
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    logoSelecionadaBase64 = reader.result;
    document.getElementById('cfg-logo-preview').innerHTML = `<img src="${logoSelecionadaBase64}" style="width:100%;height:100%;object-fit:contain;">`;
    document.getElementById('cfg-logo-upload-btn').disabled = false;
  };
  reader.readAsDataURL(file);
}

async function handleUploadLogo() {
  if (!logoSelecionadaBase64) return;
  const errorEl = document.getElementById('cfg-logo-error');
  errorEl.innerHTML = '';
  try {
    await uploadAcademiaLogo(logoSelecionadaBase64);
    applyAcademiaLogo();
    applyWatermark();
    showToast('Logo atualizada!');
    renderConfiguracoesPage();
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function handleRemoveLogo() {
  confirmAction('Remover a logo da academia? Volta a mostrar o ícone padrão.', async () => {
    await removeAcademiaLogo();
    if (data.meta.watermarkAtivo) await updateWatermarkAtivo(false);
    applyAcademiaLogo();
    applyWatermark();
    showToast('Logo removida.');
    renderConfiguracoesPage();
  });
}

async function handleToggleWatermark() {
  const ativo = document.getElementById('cfg-watermark-ativo').checked;
  await updateWatermarkAtivo(ativo);
  applyWatermark();
  showToast(ativo ? 'Marca d\'água ativada.' : 'Marca d\'água desativada.');
}

/* ---------------- Usuários (equipe/alunos) ---------------- */
function usuarioRow(u) {
  const aluno = u.alunoId ? data.students.find(s => s.id === u.alunoId) : null;
  return `<tr>
    <td data-label="Nome" style="text-align:left;">${escapeHtml(u.nome)}</td>
    <td data-label="E-mail" style="text-align:left;color:var(--text2);">${escapeHtml(u.email)}</td>
    <td data-label="Papel"><span class="tag" style="background:var(--surface2);">${ROLE_LABELS[u.role] || u.role}</span></td>
    <td data-label="Vínculo" style="text-align:left;">${aluno ? escapeHtml(aluno.nome) : '—'}</td>
    <td data-label="Ações" style="display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="openUsuarioForm('${u.id}')">✏️</button>
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="openUsuarioSenhaModal('${u.id}', '${escapeHtml(u.nome).replace(/'/g, "\\'")}')">🔑</button>
      <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="handleDeleteUsuario('${u.id}', '${escapeHtml(u.nome).replace(/'/g, "\\'")}')">🗑️</button>
    </td>
  </tr>`;
}

function alunoSelectOptions(selectedId) {
  return data.students.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`).join('');
}

function openUsuarioForm(id) {
  const u = id ? usuariosCache.find(x => x.id === id) : null;
  const role = u?.role || 'operacao';

  openModal(id ? 'Editar Usuário' : 'Novo Usuário', `
    <div class="form-group"><label>Nome</label><input type="text" id="us-nome" value="${escapeHtml(u?.nome || '')}"></div>
    <div class="form-group" style="margin-top:12px;"><label>E-mail (login)</label><input type="email" id="us-email" value="${escapeHtml(u?.email || '')}" ${id ? 'disabled' : ''}></div>
    ${!id ? `<div class="form-group" style="margin-top:12px;"><label>Senha inicial</label><input type="password" id="us-senha" placeholder="Mínimo 6 caracteres"></div>` : ''}
    <div class="form-group" style="margin-top:12px;">
      <label>Papel</label>
      <select id="us-role" onchange="onUsuarioRoleChange()">
        <option value="operacao" ${role === 'operacao' ? 'selected' : ''}>Operação — acesso à equipe (sem financeiro)</option>
        <option value="aluno" ${role === 'aluno' ? 'selected' : ''}>Aluno — portal só com os próprios dados</option>
      </select>
    </div>
    <div class="form-group" id="us-aluno-group" style="margin-top:12px;display:${role === 'aluno' ? 'block' : 'none'};">
      <label>Aluno vinculado</label>
      <select id="us-aluno-id">${alunoSelectOptions(u?.alunoId)}</select>
    </div>
    <div id="us-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="saveUsuarioForm(${id ? `'${id}'` : null})">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '460px' });
}

function onUsuarioRoleChange() {
  const role = document.getElementById('us-role').value;
  document.getElementById('us-aluno-group').style.display = role === 'aluno' ? 'block' : 'none';
}

async function saveUsuarioForm(id) {
  const nome = document.getElementById('us-nome').value.trim();
  const role = document.getElementById('us-role').value;
  const alunoId = role === 'aluno' ? document.getElementById('us-aluno-id').value : null;
  const errorEl = document.getElementById('us-error');
  errorEl.innerHTML = '';

  if (!nome) { errorEl.innerHTML = `<div class="alert alert-danger">Informe o nome.</div>`; return; }
  if (role === 'aluno' && !alunoId) { errorEl.innerHTML = `<div class="alert alert-danger">Selecione o aluno vinculado.</div>`; return; }

  try {
    if (id) {
      await updateUsuario(id, { nome, role, alunoId });
    } else {
      const email = document.getElementById('us-email').value.trim();
      const senha = document.getElementById('us-senha').value;
      if (!email || !senha) { errorEl.innerHTML = `<div class="alert alert-danger">Informe e-mail e senha.</div>`; return; }
      await createUsuario({ nome, email, senha, role, alunoId });
    }
    closeModal();
    showToast(id ? 'Usuário atualizado!' : 'Usuário criado!');
    renderConfiguracoesPage();
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function openUsuarioSenhaModal(id, nome) {
  openModal(`Trocar Senha — ${nome}`, `
    <div class="form-group"><label>Nova senha</label><input type="password" id="us-nova-senha" placeholder="Mínimo 6 caracteres"></div>
    <div id="us-senha-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="handleUsuarioSenha('${id}')">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '420px' });
}

async function handleUsuarioSenha(id) {
  const novaSenha = document.getElementById('us-nova-senha').value;
  const errorEl = document.getElementById('us-senha-error');
  errorEl.innerHTML = '';
  if (!novaSenha || novaSenha.length < 6) {
    errorEl.innerHTML = `<div class="alert alert-danger">A senha precisa ter pelo menos 6 caracteres.</div>`;
    return;
  }
  try {
    await updateUsuarioSenha(id, novaSenha);
    closeModal();
    showToast('Senha atualizada!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function handleDeleteUsuario(id, nome) {
  confirmAction(`Remover o acesso de <strong>${nome}</strong>? A pessoa não conseguirá mais entrar no sistema.`, async () => {
    await deleteUsuario(id);
    showToast('Usuário removido.');
    renderConfiguracoesPage();
  });
}
