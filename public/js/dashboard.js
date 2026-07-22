/* ==========================================================================
   DASHBOARD — visão geral com os KPIs principais da academia
   ========================================================================== */

function renderDashboardPage() {
  const k = computeKPIs();
  const diag = computePlanejamentoDiagnostico();
  const mesAtualLabel = monthLabel(currentYearMonth());

  document.getElementById('page-dashboard').innerHTML = `
    <div class="section-header">
      <div><h1>Dashboard</h1><p class="subtitle" style="margin:0;">Visão geral de ${escapeHtml(data.meta.empresa)} — janela móvel de 12 meses</p></div>
    </div>

    <div class="card-grid card-grid-4" style="margin-bottom:24px;">
      <div class="kpi ${k.rsiAnual===null ? 'kpi-yellow' : k.rsiAnual>=0 ? 'kpi-green' : 'kpi-red'}">
        <div class="kpi-label">RSI — Retorno s/ Investimento a.a.</div>
        <div class="kpi-value">${k.rsiAnual===null ? '—' : fmtPct(k.rsiAnual)}</div>
        <div class="kpi-sub">${k.rsiAnual===null ? 'Sem investimento registrado no período' : 'Lucro líquido ÷ investimento (12m)'}</div>
      </div>
      <div class="kpi ${k.lucroLiquidoMesAtual>=0?'kpi-green':'kpi-red'}">
        <div class="kpi-label">Lucro Líquido</div>
        <div class="kpi-value">${fmt(k.lucroLiquidoMesAtual)}</div>
        <div class="kpi-sub">${mesAtualLabel} · Acum. 12m: ${fmt(k.lucroLiquidoTotal)}</div>
      </div>
      <div class="kpi kpi-yellow">
        <div class="kpi-label">A Receber</div>
        <div class="kpi-value">${fmt(k.aReceberTotal)}</div>
        <div class="kpi-sub">${k.aReceberVencido>0 ? '⚠️ ' + fmt(k.aReceberVencido) + ' vencido' : 'Nenhum vencido'}</div>
      </div>
      <div class="kpi kpi-red">
        <div class="kpi-label">A Pagar</div>
        <div class="kpi-value">${fmt(k.aPagarTotal)}</div>
        <div class="kpi-sub">${k.aPagarVencido>0 ? '⚠️ ' + fmt(k.aPagarVencido) + ' vencido' : 'Nenhum vencido'}</div>
      </div>
    </div>

    <div class="card-grid card-grid-4" style="margin-bottom:24px;">
      <div class="kpi kpi-accent"><div class="kpi-label">Saldo de Caixa</div><div class="kpi-value">${fmt(k.saldoCaixa)}</div><div class="kpi-sub">Recebido − Pago (acumulado)</div></div>
      <div class="kpi kpi-accent"><div class="kpi-label">Alunos Ativos</div><div class="kpi-value">${k.alunosAtivos}</div></div>
      <div class="kpi kpi-green"><div class="kpi-label">Entradas (12m)</div><div class="kpi-value">${fmt(k.entradasTotal)}</div></div>
      <div class="kpi kpi-red"><div class="kpi-label">Saídas (12m)</div><div class="kpi-value">${fmt(k.saidasTotal)}</div></div>
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
