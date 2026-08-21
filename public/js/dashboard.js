/* ==========================================================================
   DASHBOARD — visão geral com os KPIs principais da academia
   ========================================================================== */

function renderDashboardPage() {
  const k = computeKPIs();
  const diag = computePlanejamentoDiagnostico();
  const mesAtualLabel = monthLabel(currentYearMonth());

  document.getElementById('page-dashboard').innerHTML = `
    <div class="section-header">
      <div><h1>Dashboard</h1><p class="subtitle" style="margin:0;">Visão geral de ${escapeHtml(data.meta.empresa)} — resultado de ${mesAtualLabel}</p></div>
    </div>

    <div class="card-grid card-grid-3" style="margin-bottom:16px;">
      <div class="kpi kpi-green">
        <div class="kpi-label">Entradas</div>
        <div class="kpi-value">${fmt(k.entradasMes)}</div>
        <div class="kpi-sub">${mesAtualLabel}</div>
      </div>
      <div class="kpi kpi-red">
        <div class="kpi-label">Saídas</div>
        <div class="kpi-value">${fmt(k.saidasMes)}</div>
        <div class="kpi-sub">${mesAtualLabel}</div>
      </div>
      <div class="kpi ${k.lucroLiquidoMesAtual>=0?'kpi-green':'kpi-red'}">
        <div class="kpi-label">Lucro Líquido</div>
        <div class="kpi-value">${fmt(k.lucroLiquidoMesAtual)}</div>
        <div class="kpi-sub">${mesAtualLabel}</div>
      </div>
    </div>

    <div class="card-grid card-grid-2" style="margin-bottom:24px;">
      <div class="kpi kpi-accent">
        <div class="kpi-label">Receita Recorrente Prevista do Mês</div>
        <div class="kpi-value">${fmt(k.receitaRecorrentePrevista)}</div>
      </div>
      <div class="kpi kpi-accent">
        <div class="kpi-label">Número de Alunos Ativos</div>
        <div class="kpi-value">${k.alunosAtivos}</div>
      </div>
    </div>

    <div class="alert alert-${diag.alerta.nivel === 'critico' ? 'danger' : diag.alerta.nivel === 'atencao' ? 'warning' : 'success'}">
      ${diag.alerta.nivel === 'critico' ? '🔴' : diag.alerta.nivel === 'atencao' ? '🟡' : '🟢'} <strong>Ocupação do Tatame:</strong> ${diag.alerta.texto}
    </div>
  `;
}

function refreshDashboard() {
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    renderDashboardPage();
  }
}
