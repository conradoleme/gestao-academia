/* App instalável (PWA nível 1): ícone na tela inicial, tela cheia e nome/logo da própria academia.
   De propósito SEM service worker e sem cache offline: nada é guardado no aparelho e o
   sistema continua atualizando como antes. */

const PWA_DISPENSADO_KEY = 'pwa_convite_dispensado';
let pwaPromptAdiado = null; // evento do Chrome/Android que permite instalar com um toque
let pwaGerandoIcone = false;

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwaPromptAdiado = e; pwaAtualizarConvites(); });
window.addEventListener('appinstalled', () => { pwaPromptAdiado = null; pwaAtualizarConvites(); });

function pwaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pwaInstalado() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function pwaEhIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function pwaEhCelular() {
  return pwaEhIOS() || /Android/i.test(navigator.userAgent || '');
}

function pwaDispensado() {
  try { return localStorage.getItem(PWA_DISPENSADO_KEY) === '1'; } catch (e) { return false; }
}

/* Aponta o manifesto e o ícone do iPhone pra academia certa. O iPhone lê isso no momento de
   "Adicionar à Tela de Início", então precisa estar certo antes da pessoa tocar. */
function pwaAplicarMarca({ slug, nome, iconeUrl } = {}) {
  const manifesto = document.getElementById('pwa-manifest');
  if (manifesto) manifesto.setAttribute('href', slug ? '/manifest.webmanifest?slug=' + encodeURIComponent(slug) : '/manifest.webmanifest');
  const icone = document.getElementById('pwa-apple-icon');
  if (icone) icone.setAttribute('href', iconeUrl || '/icons/apple-touch-icon.png');
  const titulo = document.getElementById('pwa-apple-title');
  if (titulo && nome) titulo.setAttribute('content', String(nome).slice(0, 30));
}

function pwaConviteVisivel(dispensavel) {
  if (pwaInstalado()) return false;
  if (!(pwaEhCelular() || pwaPromptAdiado)) return false;
  if (dispensavel && pwaDispensado()) return false;
  return true;
}

function pwaConviteHtml(nome, iconeUrl, dispensavel) {
  if (!pwaConviteVisivel(dispensavel)) return '';
  return `<div class="pwa-convite">
    <img class="pwa-ico" src="${pwaEsc(iconeUrl || '/icons/icon-192.png')}" alt="">
    <div class="pwa-txt"><b>Instalar o app${nome ? ' da ' + pwaEsc(nome) : ''}</b><span>Abre em tela cheia, direto da tela inicial.</span></div>
    <button class="btn btn-primary" onclick="pwaInstalar()">Instalar</button>
    ${dispensavel ? '<button class="pwa-x" aria-label="Fechar" onclick="pwaDispensar(this)">✕</button>' : ''}
  </div>`;
}

/* Lugar reservado na tela: se o convite aparecer depois (Android avisa tarde), é só redesenhar o lugar. */
function pwaSlot(nome, iconeUrl, dispensavel = true) {
  return `<div class="pwa-slot" data-nome="${pwaEsc(nome || '')}" data-icone="${pwaEsc(iconeUrl || '')}" data-disp="${dispensavel ? '1' : '0'}">${pwaConviteHtml(nome, iconeUrl, dispensavel)}</div>`;
}
function pwaAtualizarConvites() {
  document.querySelectorAll('.pwa-slot').forEach(el => {
    el.innerHTML = pwaConviteHtml(el.dataset.nome, el.dataset.icone, el.dataset.disp === '1');
  });
}

function pwaDispensar(el) {
  try { localStorage.setItem(PWA_DISPENSADO_KEY, '1'); } catch (e) { /* sem armazenamento: some só nesta tela */ }
  const slot = el && el.closest('.pwa-slot');
  if (slot) slot.innerHTML = '';
}

async function pwaInstalar() {
  if (pwaPromptAdiado) {
    const p = pwaPromptAdiado;
    pwaPromptAdiado = null;
    try { p.prompt(); await p.userChoice; } catch (e) { /* a pessoa fechou */ }
    pwaAtualizarConvites();
    return;
  }
  pwaAbrirInstrucoes();
}

function pwaAbrirInstrucoes() {
  const compartilhar = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;"><path d="M12 15V3M8 7l4-4 4 4M5 11v9h14v-9"/></svg>';
  const passo = (n, t) => `<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border);"><span style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:700;font-size:12px;flex:none;">${n}</span><span>${t}</span></div>`;
  const corpo = pwaEhIOS()
    ? `<p style="color:var(--text2);margin-bottom:8px;">No iPhone o app é instalado pelo Safari, em três toques:</p>
       ${passo(1, `Toque em <strong>Compartilhar</strong> ${compartilhar} na barra do Safari`)}
       ${passo(2, 'Role e toque em <strong>Adicionar à Tela de Início</strong>')}
       ${passo(3, 'Toque em <strong>Adicionar</strong>')}`
    : `<p style="color:var(--text2);margin-bottom:8px;">No menu do navegador (⋮ ou ⋯), toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>`;
  openModal('Instalar o app', corpo + '<div class="btn-row" style="margin-top:14px;"><button class="btn btn-secondary" onclick="closeModal()">Entendi</button></div>', { width: '420px' });
}

/* ---------- Ícone do app a partir do logo (gerado aqui, no navegador, sem biblioteca no servidor) ---------- */
async function pwaGerarIconeDaLogo(logoUrl) {
  const img = await new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error('Não foi possível ler o logo.'));
    i.src = logoUrl;
  });
  const L = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = L;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, L, L);
  const area = L * 0.76; // margem de ~12% em cada lado: o iPhone arredonda os cantos e o Android recorta em círculo
  const escala = Math.min(area / img.naturalWidth, area / img.naturalHeight);
  const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
  ctx.drawImage(img, (L - w) / 2, (L - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

async function pwaEnviarIconeDaLogo() {
  if (!data.meta.logoUrl) return;
  const imageBase64 = await pwaGerarIconeDaLogo(data.meta.logoUrl);
  const r = await api.put('/api/academia/icone', { imageBase64 });
  data.meta.iconeUrl = r.iconeUrl + '?t=' + Date.now();
  pwaAplicarMarca({ slug: data.meta.slug, nome: data.meta.empresa, iconeUrl: data.meta.iconeUrl });
  // quem já está na tela passa a mostrar o ícone novo
  document.querySelectorAll('.pwa-slot').forEach(el => { el.dataset.icone = data.meta.iconeUrl; });
  pwaAtualizarConvites();
  const txt = document.getElementById('cfg-pwa-icone-txt');
  if (txt) txt.textContent = 'Ícone do app: gerado a partir do seu logo.';
}

/* Academia com logo mas sem ícone (já existia antes deste recurso): gera uma vez, em segundo plano. */
async function pwaGarantirIcone() {
  if (pwaGerandoIcone || !data || !data.meta || !data.meta.logoUrl || data.meta.iconeUrl) return;
  pwaGerandoIcone = true;
  try {
    await pwaEnviarIconeDaLogo();
    const prev = document.getElementById('cfg-pwa-icone');
    if (prev) prev.src = data.meta.iconeUrl;
  } catch (e) { /* o ícone padrão continua valendo */ } finally { pwaGerandoIcone = false; }
}
