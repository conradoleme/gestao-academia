/* ==========================================================================
   DASHBOARD — visão geral com os KPIs principais da academia
   ========================================================================== */

function renderDashboardPage() {
  const k = computeKPIs();
  const diag = computePlanejamentoDiagnostico();
  const dica = computeGestaoDica(k);
  const mesAtualLabel = monthLabel(currentYearMonth());
  const emRisco = computeAlunosEmRisco();

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

    <div class="alert alert-${dica.nivel === 'critico' ? 'danger' : dica.nivel === 'atencao' ? 'warning' : 'success'}" style="margin-bottom:16px;">
      ${dica.nivel === 'critico' ? '🔴' : dica.nivel === 'atencao' ? '🟡' : '🟢'} <strong>Dica de Gestão:</strong> ${dica.texto}
    </div>

    <div class="alert alert-${diag.alerta.nivel === 'critico' ? 'danger' : diag.alerta.nivel === 'atencao' ? 'warning' : 'success'}" style="margin-bottom:${emRisco.length ? '16px' : '0'};">
      ${diag.alerta.nivel === 'critico' ? '🔴' : diag.alerta.nivel === 'atencao' ? '🟡' : '🟢'} <strong>Ocupação do Tatame:</strong> ${diag.alerta.texto}
    </div>

    ${emRisco.length ? `
      <div class="card">
        <h3 style="margin-bottom:4px;">⚠️ Risco de Evasão</h3>
        <p style="color:var(--text2);font-size:12.5px;margin-bottom:14px;">
          Alunos treinando bem menos que o normal deles nas últimas semanas — vale um contato antes que virem cancelamento ou inadimplência.
        </p>
        <div class="table-wrap table-responsive-cards">
          <table>
            <thead><tr><th style="text-align:left;">Aluno</th><th>Última vez</th><th>Frequência antes</th><th>Frequência agora</th><th>Ações</th></tr></thead>
            <tbody>${emRisco.slice(0, 8).map(({ student, risco }) => `
              <tr>
                <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
                <td data-label="Última vez" class="${risco.diasSemTreinar >= 21 ? 'neg' : ''}">${risco.diasSemTreinar} dias atrás</td>
                <td data-label="Frequência antes">${risco.baselineSemanal.toFixed(1)}x/sem.</td>
                <td data-label="Frequência agora" class="neg">${risco.recenteSemanal.toFixed(1)}x/sem.</td>
                <td data-label="Ações"><button class="btn-icon" title="Ver ficha do aluno" onclick="showPage('alunos').then(()=>openStudentForm('${student.id}'))">👤</button></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function refreshDashboard() {
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    renderDashboardPage();
  }
}
