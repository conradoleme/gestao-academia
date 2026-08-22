/* ==========================================================================
   PAINEL ADMIN — visão de todas as academias cadastradas + status de
   pagamento. Login próprio (e-mail+senha, conta em super_admins), separado
   do login das academias. Token guardado só em sessionStorage — some ao
   fechar a aba, de propósito: é a credencial mais sensível do sistema.
   ========================================================================== */

const ADMIN_TOKEN_STORAGE = 'admin_panel_token';
let academiasCache = [];

function getAdminToken() { return sessionStorage.getItem(ADMIN_TOKEN_STORAGE); }
function setAdminToken(t) { sessionStorage.setItem(ADMIN_TOKEN_STORAGE, t); }
function clearAdminToken() { sessionStorage.removeItem(ADMIN_TOKEN_STORAGE); }

async function adminFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getAdminToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    clearAdminToken();
    showAdminLogin('Sessão expirada — faça login novamente.');
    throw new Error('Não autenticado.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro (${res.status}).`);
  return body;
}

function showAdminLogin(errorMsg) {
  document.getElementById('admin-login-error').innerHTML = errorMsg
    ? `<div class="alert alert-danger">${escapeHtml(errorMsg)}</div>` : '';
  document.getElementById('admin-login-screen').style.display = 'block';
  document.getElementById('admin-app').style.display = 'none';
}
function hideAdminLogin() {
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
}

function handleAdminLogout() {
  clearAdminToken();
  academiasCache = [];
  showAdminLogin();
}

async function handleAdminLogin() {
  const email = document.getElementById('admin-email-input').value.trim();
  const senha = document.getElementById('admin-senha-input').value;
  if (!email || !senha) return;
  try {
    const { token } = await adminFetch('/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    setAdminToken(token);
    await loadAcademias();
    hideAdminLogin();
  } catch (e) {
    clearAdminToken();
    showAdminLogin(e.message || 'Erro ao entrar.');
  }
}

function openAdminTrocarSenhaModal() {
  openModal('Trocar Minha Senha', `
    <div class="form-group"><label>Senha atual</label><input type="password" id="admin-senha-atual-input" autocomplete="current-password"></div>
    <div class="form-group" style="margin-top:14px;"><label>Nova senha</label><input type="password" id="admin-senha-nova-input" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></div>
    <div id="admin-senha-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="handleAdminTrocarSenha()">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '420px' });
}

async function handleAdminTrocarSenha() {
  const senhaAtual = document.getElementById('admin-senha-atual-input').value;
  const novaSenha = document.getElementById('admin-senha-nova-input').value;
  const errorEl = document.getElementById('admin-senha-error');
  errorEl.innerHTML = '';
  if (!senhaAtual || !novaSenha) { errorEl.innerHTML = `<div class="alert alert-danger">Preencha a senha atual e a nova senha.</div>`; return; }
  try {
    await adminFetch('/admin/auth/senha', { method: 'PUT', body: JSON.stringify({ senhaAtual, novaSenha }) });
    closeModal();
    showToast('Senha atualizada!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

async function loadAcademias() {
  academiasCache = await adminFetch('/admin/academias');
  renderAdminKPIs();
  renderAcademiasTable();
}

function renderAdminKPIs() {
  const total = academiasCache.length;
  const ativas = academiasCache.filter(a => a.statusPagamento === 'ativo').length;
  const pendentes = academiasCache.filter(a => a.statusPagamento === 'pendente').length;
  const inadimplentes = academiasCache.filter(a => a.statusPagamento === 'inadimplente').length;
  const receitaMensal = academiasCache.filter(a => a.statusPagamento === 'ativo').reduce((s, a) => s + a.valorMensal, 0);

  document.getElementById('admin-kpis').innerHTML = `
    <div class="kpi kpi-accent"><div class="kpi-label">Academias Cadastradas</div><div class="kpi-value">${total}</div></div>
    <div class="kpi kpi-green"><div class="kpi-label">Em Dia</div><div class="kpi-value">${ativas}</div><div class="kpi-sub">${fmtFull(receitaMensal)}/mês</div></div>
    <div class="kpi kpi-yellow"><div class="kpi-label">Pendentes</div><div class="kpi-value">${pendentes}</div></div>
    <div class="kpi kpi-red"><div class="kpi-label">Inadimplentes</div><div class="kpi-value">${inadimplentes}</div></div>
  `;
}

function renderAcademiasTable() {
  document.getElementById('admin-academias-body').innerHTML = academiasCache.map(academiaRow).join('')
    || `<tr><td colspan="8" style="text-align:center;color:var(--text2);">Nenhuma academia cadastrada.</td></tr>`;
  academiasCache.forEach(a => {
    const input = document.getElementById(`admin-valor-${a.id}`);
    maskCurrencyInput(input);
  });
}

function academiaRow(a) {
  const criada = a.createdAt ? new Date(a.createdAt).toLocaleDateString('pt-BR') : '—';
  return `<tr>
    <td style="text-align:left;">
      <div style="font-weight:600;">${escapeHtml(a.nome)}</div>
      <div style="font-size:11px;color:var(--text2);">${escapeHtml(a.email)}</div>
    </td>
    <td>${a.totalAlunos}</td>
    <td>${a.totalTurmas}</td>
    <td>
      <select id="admin-status-${a.id}" class="mini-select">
        <option value="ativo" ${a.statusPagamento==='ativo'?'selected':''}>Ativo</option>
        <option value="pendente" ${a.statusPagamento==='pendente'?'selected':''}>Pendente</option>
        <option value="inadimplente" ${a.statusPagamento==='inadimplente'?'selected':''}>Inadimplente</option>
      </select>
    </td>
    <td><input type="text" inputmode="decimal" id="admin-valor-${a.id}" class="mini-input" style="width:90px;" value="${formatCurrencyValue(a.valorMensal)}"></td>
    <td><input type="date" id="admin-venc-${a.id}" class="mini-input" style="width:140px;" value="${a.proximoVencimento || ''}"></td>
    <td>${criada}</td>
    <td style="display:flex;gap:6px;">
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="salvarPagamento('${a.id}')">Salvar</button>
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="openTrocarSenhaModal('${a.id}', '${escapeHtml(a.nome)}')">Senha</button>
      <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="confirmarExclusaoAcademia('${a.id}', '${escapeHtml(a.nome)}')">Excluir</button>
    </td>
  </tr>`;
}

function openCreateAcademiaModal() {
  openModal('Nova Academia', `
    <div class="form-group"><label>Nome da Academia</label><input type="text" id="new-academia-nome" placeholder="Ex: Goushi BJJ"></div>
    <div class="form-group"><label>E-mail (login)</label><input type="email" id="new-academia-email" placeholder="contato@academia.com"></div>
    <div class="form-group"><label>Senha</label><input type="password" id="new-academia-senha" placeholder="Senha inicial"></div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="new-academia-turmas" style="width:auto;">
      <label style="margin:0;">Criar com turmas padrão (T730 a T2000)</label>
    </div>
    <div id="new-academia-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="handleCreateAcademia()">Criar Academia</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '460px' });
}

async function handleCreateAcademia() {
  const nome = document.getElementById('new-academia-nome').value.trim();
  const email = document.getElementById('new-academia-email').value.trim();
  const senha = document.getElementById('new-academia-senha').value;
  const turmasPadrao = document.getElementById('new-academia-turmas').checked;
  const errorEl = document.getElementById('new-academia-error');
  errorEl.innerHTML = '';

  if (!email || !senha) {
    errorEl.innerHTML = `<div class="alert alert-danger">Informe e-mail e senha.</div>`;
    return;
  }

  try {
    await adminFetch('/admin/create-academia', {
      method: 'POST',
      body: JSON.stringify({ email, senha, nome, turmasPadrao }),
    });
    closeModal();
    showToast('Academia criada com sucesso!');
    await loadAcademias();
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

async function salvarPagamento(id) {
  const statusPagamento = document.getElementById(`admin-status-${id}`).value;
  const valorMensal = parseCurrencyValue(document.getElementById(`admin-valor-${id}`).value);
  const proximoVencimento = document.getElementById(`admin-venc-${id}`).value || null;
  try {
    await adminFetch(`/admin/academias/${id}/pagamento`, {
      method: 'PUT',
      body: JSON.stringify({ statusPagamento, valorMensal, proximoVencimento }),
    });
    showToast('Pagamento atualizado!');
    await loadAcademias();
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  }
}

function openTrocarSenhaModal(id, nome) {
  openModal(`Trocar Senha — ${nome}`, `
    <div class="form-group"><label>Nova senha</label><input type="password" id="new-senha-input" placeholder="Mínimo 6 caracteres"></div>
    <div id="new-senha-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="handleTrocarSenha('${id}')">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '420px' });
}

async function handleTrocarSenha(id) {
  const novaSenha = document.getElementById('new-senha-input').value;
  const errorEl = document.getElementById('new-senha-error');
  errorEl.innerHTML = '';
  if (!novaSenha || novaSenha.length < 6) {
    errorEl.innerHTML = `<div class="alert alert-danger">A senha precisa ter pelo menos 6 caracteres.</div>`;
    return;
  }
  try {
    await adminFetch(`/admin/academias/${id}/senha`, { method: 'PUT', body: JSON.stringify({ novaSenha }) });
    closeModal();
    showToast('Senha atualizada!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function confirmarExclusaoAcademia(id, nome) {
  confirmAction(`Excluir a academia <strong>${nome}</strong>? Isso apaga todos os alunos, turmas e lançamentos dela permanentemente.`, async () => {
    try {
      await adminFetch(`/admin/academias/${id}`, { method: 'DELETE' });
      showToast('Academia excluída.');
      await loadAcademias();
    } catch (e) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  if (getAdminToken()) {
    try {
      await loadAcademias();
      hideAdminLogin();
      return;
    } catch (e) {
      clearAdminToken();
    }
  }
  showAdminLogin();
  document.getElementById('admin-senha-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });
});
