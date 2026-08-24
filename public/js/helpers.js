/* ==========================================================================
   HELPERS — formatação, gráficos simples e utilidades de UI compartilhadas
   ========================================================================== */

function fmt(v, dec = 0) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const abs = Math.abs(v);
  let str;
  if (abs >= 1000000) str = 'R$ ' + (v/1000000).toFixed(1) + 'M';
  else if (abs >= 1000) str = 'R$ ' + (v/1000).toFixed(dec > 0 ? dec : 1) + 'k';
  else str = 'R$ ' + v.toFixed(0);
  return str;
}
function fmtFull(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v, dec = 1) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(dec) + '%';
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function todayStr() { return new Date().toISOString().slice(0,10); }

/* ---------------- Máscara monetária (R$ 1.234,56) para inputs ---------------- */
function formatCurrencyValue(num) {
  return (Number(num) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrencyValue(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
function maskCurrencyInput(el) {
  if (!el) return;
  el.addEventListener('input', () => {
    let digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) { el.value = ''; return; }
    while (digits.length < 3) digits = '0' + digits;
    const cents = digits.slice(-2);
    const intPart = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = `${intPart},${cents}`;
  });
}
function monthLabel(yearMonth) {
  if (!yearMonth) return '—';
  const [y,m] = yearMonth.split('-').map(Number);
  return `${MESES_ABREV[m-1]}/${String(y).slice(2)}`;
}

/* ---------------- Autosave de formulários em modal ---------------- */
// Evita perder o que a pessoa digitou se ela fechar a aba, trocar de app ou
// simplesmente esquecer de clicar em "Salvar" — os campos vão salvando
// sozinhos enquanto digita, sem precisar de confirmação explícita.
function debounce(fn, ms = 800) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function attachAutosaveListeners(fieldIds, handler) {
  fieldIds.forEach(fid => {
    const el = document.getElementById(fid);
    if (!el) return;
    const evt = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') ? 'change' : 'input';
    el.addEventListener(evt, handler);
  });
}

function showAutosaveIndicator(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  el.textContent = `✓ Salvo automaticamente às ${hora}`;
}

/* ---------------- Copiar texto de uma textarea/input pra área de transferência ---------------- */
function copyTextareaToClipboard(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const texto = el.value;

  function fallbackCopy() {
    el.focus();
    el.select();
    try {
      if (document.execCommand('copy')) { showToast('Copiado!'); return; }
    } catch (e) { /* segue para o aviso abaixo */ }
    showToast('Não foi possível copiar automaticamente — selecione o texto e use Cmd+C.', 'error');
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).then(() => showToast('Copiado!')).catch(fallbackCopy);
  } else {
    // navigator.clipboard exige HTTPS/localhost — ao abrir via file://, cai aqui direto
    fallbackCopy();
  }
}

/* ---------------- Toast / status messages ---------------- */
function showToast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)' };
  el.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--surface);border:1px solid ${colors[type]};color:${colors[type]};padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:opacity .3s;`;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

/* ---------------- Modal genérico ---------------- */
function openModal(title, bodyHtml, { width = '560px' } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:${width};">
      <div class="modal-header">
        <h3 style="margin:0;">${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
  // Com autosave, fechar o modal de qualquer jeito (✕, clique fora, Fechar)
  // pode já ter salvo dado novo — atualiza a página de fundo pra refletir.
  const activePage = document.querySelector('.page.active');
  if (activePage && typeof PAGE_RENDERERS !== 'undefined') {
    const pageId = activePage.id.replace('page-', '');
    if (PAGE_RENDERERS[pageId]) PAGE_RENDERERS[pageId]();
  }
}

/* ---------------- Bar chart simples (reutilizado nas páginas) ---------------- */
function renderBarChart(containerId, series, labels, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const allVals = series.flatMap(s => s.values);
  const maxVal = Math.max(1, ...allVals.map(Math.abs));
  const H = opts.height || container.offsetHeight || 120;

  container.innerHTML = labels.map((label, i) => {
    const bars = series.map(s => {
      const h = maxVal > 0 ? Math.max(2, (Math.abs(s.values[i]) / maxVal) * (H - 24)) : 2;
      return `<div class="bar" style="height:${h}px;background:${s.color};opacity:0.85;flex:1;"></div>`;
    }).join('');
    return `<div class="bar-wrap">
      <div style="display:flex;gap:2px;width:100%;align-items:flex-end;">${bars}</div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('');
}

/* ---------------- Ficha médica — campos compartilhados entre a tela de
   gestão (students.js, qualquer aluno) e o portal (aluno-portal.js, só a
   própria ficha). Dado sensível (LGPD) — nunca entra no bootstrap, só é
   buscado quando alguém abre a ficha de verdade. ---------------- */
function fichaMedicaFormFields(f) {
  return `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);font-weight:600;margin-bottom:8px;">Contato de Emergência</div>
    <div class="form-grid">
      <div class="form-group"><label>Nome</label><input type="text" id="fm-emerg-nome" value="${escapeHtml(f.contatoEmergenciaNome)}"></div>
      <div class="form-group"><label>Parentesco</label><input type="text" id="fm-emerg-parentesco" value="${escapeHtml(f.contatoEmergenciaParentesco)}" placeholder="Ex: mãe, cônjuge"></div>
      <div class="form-group"><label>Telefone</label><input type="tel" id="fm-emerg-telefone" value="${escapeHtml(f.contatoEmergenciaTelefone)}" placeholder="11987654321"></div>
      <div class="form-group"><label>Tipo Sanguíneo</label><input type="text" id="fm-tipo-sanguineo" value="${escapeHtml(f.tipoSanguineo)}" placeholder="Ex: O+" style="max-width:100px;"></div>
    </div>

    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);font-weight:600;margin:16px 0 8px;">Saúde</div>
    <div class="form-group"><label>Alergias</label><textarea id="fm-alergias" style="min-height:50px;" placeholder="Medicamentos, alimentos, outras — ou 'nenhuma'">${escapeHtml(f.alergias)}</textarea></div>
    <div class="form-group" style="margin-top:10px;"><label>Condições médicas</label><textarea id="fm-condicoes" style="min-height:50px;" placeholder="Cardíaco, asma, diabetes, pressão, epilepsia...">${escapeHtml(f.condicoesMedicas)}</textarea></div>
    <div class="form-group" style="margin-top:10px;"><label>Medicamentos de uso contínuo</label><textarea id="fm-medicamentos" style="min-height:50px;">${escapeHtml(f.medicamentos)}</textarea></div>
    <div class="form-group" style="margin-top:10px;"><label>Lesões prévias / cirurgias</label><textarea id="fm-lesoes" style="min-height:50px;" placeholder="Joelho, ombro, coluna...">${escapeHtml(f.lesoesPrevias)}</textarea></div>
    <div class="form-group" style="margin-top:10px;"><label>Restrição médica pra prática</label><textarea id="fm-restricao" style="min-height:50px;" placeholder="Alguma limitação de movimento ou esforço?">${escapeHtml(f.restricaoPratica)}</textarea></div>

    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);font-weight:600;margin:16px 0 8px;">Responsável Legal <span style="text-transform:none;font-weight:400;">(se menor de idade)</span></div>
    <div class="form-grid">
      <div class="form-group"><label>Nome</label><input type="text" id="fm-resp-nome" value="${escapeHtml(f.responsavelLegalNome)}"></div>
      <div class="form-group"><label>Telefone</label><input type="tel" id="fm-resp-telefone" value="${escapeHtml(f.responsavelLegalTelefone)}"></div>
    </div>
  `;
}

function fichaMedicaFormPayload() {
  return {
    contatoEmergenciaNome: document.getElementById('fm-emerg-nome').value.trim(),
    contatoEmergenciaParentesco: document.getElementById('fm-emerg-parentesco').value.trim(),
    contatoEmergenciaTelefone: document.getElementById('fm-emerg-telefone').value.trim(),
    tipoSanguineo: document.getElementById('fm-tipo-sanguineo').value.trim(),
    alergias: document.getElementById('fm-alergias').value.trim(),
    condicoesMedicas: document.getElementById('fm-condicoes').value.trim(),
    medicamentos: document.getElementById('fm-medicamentos').value.trim(),
    lesoesPrevias: document.getElementById('fm-lesoes').value.trim(),
    restricaoPratica: document.getElementById('fm-restricao').value.trim(),
    responsavelLegalNome: document.getElementById('fm-resp-nome').value.trim(),
    responsavelLegalTelefone: document.getElementById('fm-resp-telefone').value.trim(),
  };
}

/* ---------------- Confirmação simples ---------------- */
function confirmAction(msg, onConfirm) {
  openModal('Confirmar ação', `
    <p style="margin-bottom:20px;color:var(--text);">${msg}</p>
    <div class="btn-row">
      <button class="btn btn-danger" id="confirm-yes">Confirmar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '420px' });
  document.getElementById('confirm-yes').onclick = () => { onConfirm(); closeModal(); };
}
