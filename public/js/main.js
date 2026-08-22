/* ==========================================================================
   MAIN — navegação entre páginas e inicialização do app
   ========================================================================== */

const PAGE_RENDERERS = {
  dashboard: renderDashboardPage,
  alunos: renderAlunosPage,
  turmas: renderTurmasPage,
  chamada: renderChamadaPage,
  financas: renderFinancePage,
  inadimplencia: renderInadimplenciaPage,
  ganhos: renderGanhosPage,
  simulador: renderSimuladorPage,
  configuracoes: renderConfiguracoesPage,
};

async function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  closeMobileNav();
  if (PAGE_RENDERERS[id]) await PAGE_RENDERERS[id]();
}

/* ---------------- Menu (gaveta) no celular ---------------- */
function toggleMobileNav() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-backdrop').classList.toggle('open');
}
function closeMobileNav() {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-backdrop').classList.remove('open');
}

/* ---------------- Tema (claro/escuro) ---------------- */
const THEME_KEY = 'goushi_theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  if (theme === 'dark') { icon.textContent = '☀️'; label.textContent = 'Modo Claro'; }
  else { icon.textContent = '🌙'; label.textContent = 'Modo Escuro'; }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
}

/* ---------------- Restrições de menu por papel ---------------- */
// Operação (equipe) cuida do dia a dia — alunos, turmas, inadimplência e
// simulação de ganhos — mas não tem acesso às telas financeiras/de conta.
const OPERACAO_PAGINAS_OCULTAS = ['dashboard', 'financas', 'simulador', 'configuracoes'];

function applyRoleUI(role) {
  if (role !== 'operacao') return;
  OPERACAO_PAGINAS_OCULTAS.forEach(id => {
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.style.display = 'none';
  });
}

/* ---------------- Logo personalizada da academia ---------------- */
function applyAcademiaLogo() {
  const html = data.meta.logoUrl
    ? `<img src="${data.meta.logoUrl}" style="height:22px;vertical-align:middle;border-radius:4px;">`
    : '🥋';
  const desktop = document.getElementById('app-logo-emoji');
  const mobile = document.getElementById('app-logo-emoji-mobile');
  if (desktop) desktop.innerHTML = html;
  if (mobile) mobile.innerHTML = html;
}

function applyWatermark() {
  const container = document.getElementById('app-watermark');
  const img = document.getElementById('app-watermark-img');
  if (!container || !img) return;
  if (data.meta.watermarkAtivo && data.meta.logoUrl) {
    img.src = data.meta.logoUrl;
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

/* ---------------- Boot pós-login ---------------- */
async function bootAppAfterLogin() {
  await loadDataFromApi();
  await autoGenerateOnLoad();
  document.getElementById('app-empresa-nome').textContent = data.meta.empresa;
  document.getElementById('app-empresa-nome-mobile').textContent = data.meta.empresa;
  applyAcademiaLogo();
  applyWatermark();
  const role = decodeAuthToken()?.role;
  applyRoleUI(role);
  showPage(role === 'operacao' ? 'alunos' : 'dashboard');
}

async function initApp() {
  initTheme();
  const hasSession = await checkExistingSession();
  if (hasSession) await bootByRole();
}

window.addEventListener('DOMContentLoaded', initApp);
