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
function monthLabel(yearMonth) {
  if (!yearMonth) return '—';
  const [y,m] = yearMonth.split('-').map(Number);
  return `${MESES_ABREV[m-1]}/${String(y).slice(2)}`;
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
