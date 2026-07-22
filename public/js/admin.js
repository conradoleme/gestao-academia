/* ==========================================================================
   PAINEL ADMIN — visão de todas as academias cadastradas + status de
   pagamento. Autenticação separada do login das academias: usa a mesma
   ADMIN_SETUP_KEY do backend, guardada só em sessionStorage (some ao
   fechar a aba).
   ========================================================================== */

const ADMIN_KEY_STORAGE = 'admin_panel_key';
let academiasCache = [];

function getAdminKey() { return sessionStorage.getItem(ADMIN_KEY_STORAGE); }
function setAdminKey(k) { sessionStorage.setItem(ADMIN_KEY_STORAGE, k); }
function clearAdminKey() { sessionStorage.removeItem(ADMIN_KEY_STORAGE); }

async function adminFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Admin-Key': getAdminKey() || '', ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers });
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

async function handleAdminLogin() {
  const key = document.getElementById('admin-key-input').value.trim();
  if (!key) return;
  setAdminKey(key);
  try {
    await loadAcademias();
    hideAdminLogin();
  } catch (e) {
    clearAdminKey();
    showAdminLogin('Chave incorreta ou erro de conexão.');
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
    <td><button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="salvarPagamento('${a.id}')">Salvar</button></td>
  </tr>`;
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

window.addEventListener('DOMContentLoaded', async () => {
  if (getAdminKey()) {
    try {
      await loadAcademias();
      hideAdminLogin();
      return;
    } catch (e) {
      clearAdminKey();
    }
  }
  showAdminLogin();
  const input = document.getElementById('admin-key-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });
});
