/* ==========================================================================
   MAIN — navegação entre páginas e inicialização do app
   ========================================================================== */

const PAGE_RENDERERS = {
  dashboard: renderDashboardPage,
  alunos: renderAlunosPage,
  turmas: renderTurmasPage,
  chamada: renderChamadaPage,
  graduacao: renderGraduacaoPage,
  mural: renderMuralPage,
  financas: renderFinancePage,
  inadimplencia: renderInadimplenciaPage,
  ganhos: renderGanhosPage,
  simulador: renderSimuladorPage,
  configuracoes: renderConfiguracoesPage,
};

async function showPage(id) {
  if (document.getElementById('modal-overlay')) closeModal();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  closeMobileNav();
  if (PAGE_RENDERERS[id]) await PAGE_RENDERERS[id]();
  if (typeof updateGraduacaoBadge === 'function') updateGraduacaoBadge();
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
// Operação (equipe) cuida do dia a dia — alunos, turmas, chamada, graduação
// — mas não tem acesso a nada financeiro: cobrança e simulação de ganhos
// são só do dono, igual fluxo de caixa e simulador de cenários já eram.
// Dashboard fica visível pros dois papéis: pra operação ele mostra só as
// Aulas de Hoje (renderDashboardPage decide o que exibir pelo role), sem
// nenhum KPI financeiro.
const OPERACAO_PAGINAS_OCULTAS = ['financas', 'simulador', 'configuracoes', 'inadimplencia', 'ganhos'];

function applyRoleUI(role) {
  if (role !== 'operacao') return;
  OPERACAO_PAGINAS_OCULTAS.forEach(id => {
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.style.display = 'none';
  });

  // Esconder um botão pode deixar a seção acima dele órfã (ex: "Visão
  // Geral" só tinha o Dashboard) ou com um item só (ex: "Financeiro" fica
  // só com Cobrança) — some com o cabeçalho quando sobra no máximo 1 botão
  // visível nele; o botão continua ali, só sem o rótulo de seção solto.
  document.querySelectorAll('.sidebar .nav-section').forEach(section => {
    let botoesVisiveis = 0;
    let el = section.nextElementSibling;
    while (el && el.classList.contains('nav-btn')) {
      if (el.style.display !== 'none') botoesVisiveis++;
      el = el.nextElementSibling;
    }
    if (botoesVisiveis <= 1) section.style.display = 'none';
  });
}

/* ---------------- Assinatura da plataforma (trial + engrenagem) ----------------
   Só o dono (admin) mexe com isso — é o dinheiro que a ACADEMIA paga pra
   usar o sistema, não tem nada a ver com o financeiro dos alunos dela,
   então operação/aluno nunca veem essa faixa nem a engrenagem. */
function applyAssinaturaUI(role) {
  const btnEngrenagem = document.getElementById('btn-minha-assinatura');
  const banner = document.getElementById('trial-banner');
  const ehDono = role === 'admin' && !decodeAuthToken()?.userId;
  if (!ehDono) {
    if (btnEngrenagem) btnEngrenagem.style.display = 'none';
    if (banner) banner.style.display = 'none';
    return;
  }
  if (btnEngrenagem) btnEngrenagem.style.display = 'inline-flex';
  if (!banner) return;

  if (!data.meta.trialEndsAt || data.meta.stripeAssinaturaAtiva) {
    banner.style.display = 'none';
    return;
  }
  const hoje = new Date(todayStr() + 'T00:00:00');
  const fim = new Date(data.meta.trialEndsAt + 'T00:00:00');
  const dias = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));

  banner.style.display = 'block';
  if (dias > 0) {
    banner.style.cssText = 'display:block;margin:8px 0;padding:8px 10px;border-radius:8px;font-size:11.5px;line-height:1.4;background:var(--surface2);color:var(--text2);';
    banner.innerHTML = `🕐 Período grátis: <strong style="color:var(--text);">${dias} dia(s)</strong> restante(s). <a href="#" onclick="openMinhaAssinaturaModal();return false;" style="color:var(--accent);">Assinar agora</a>`;
  } else {
    banner.style.cssText = 'display:block;margin:8px 0;padding:8px 10px;border-radius:8px;font-size:11.5px;line-height:1.4;background:rgba(220,38,38,0.1);color:var(--red);';
    banner.innerHTML = `⚠️ Seu período grátis acabou. <a href="#" onclick="openMinhaAssinaturaModal();return false;" style="color:inherit;text-decoration:underline;">Assinar agora</a>`;
  }
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
  applyAssinaturaUI(role);
  updateGraduacaoBadge();
  showPage(role === 'operacao' ? 'alunos' : 'dashboard');
}

async function initApp() {
  initTheme();
  const hasSession = await checkExistingSession();
  if (hasSession) await bootByRole();
}

window.addEventListener('DOMContentLoaded', initApp);
