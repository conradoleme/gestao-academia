/* ==========================================================================
   DASHBOARD — visão geral com os KPIs principais da academia
   ========================================================================== */

/* Turma cai no dia de hoje se algum horário dela bate com o dia da semana
   atual — DIAS_SEMANA[0] é Segunda, então getDay()==1 (Monday) vira índice 0. */
function computeAulasHoje() {
  const jsDay = new Date().getDay();
  const hojeDia = DIAS_SEMANA[jsDay === 0 ? 6 : jsDay - 1];
  const aulas = [];
  (data.turmas || []).forEach(t => {
    (t.horarios || []).forEach(h => {
      if (h.dia === hojeDia && h.hora) aulas.push({ turma: t.nome, hora: h.hora });
    });
  });
  aulas.sort((a, b) => a.hora.localeCompare(b.hora));
  return { hojeDia, aulas };
}

function irParaCobrancaDoMes() {
  inadimplenciaSelectedMonth = currentYearMonth();
  showPage('inadimplencia');
}

function irParaChamadaDaTurma(nomeTurma) {
  chamadaData = todayStr();
  chamadaTurma = nomeTurma;
  showPage('chamada');
}

function renderAulasHojeCard() {
  const { hojeDia, aulas } = computeAulasHoje();
  return `
    <div class="card" style="margin-bottom:24px;">
      <h3 style="margin-bottom:4px;">📅 Aulas de Hoje</h3>
      <p style="color:var(--text2);font-size:12.5px;margin-bottom:14px;">${hojeDia} — clique numa turma pra marcar presença</p>
      ${aulas.length ? `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${aulas.map(a => `
            <button data-turma="${escapeHtml(a.turma)}" onclick="irParaChamadaDaTurma(this.dataset.turma)" style="all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:10px;padding:14px 16px;">
              <span style="font-weight:600;">${escapeHtml(a.turma)}</span>
              <span style="color:var(--accent);font-size:13px;font-weight:600;">${a.hora} →</span>
            </button>
          `).join('')}
        </div>
      ` : `<p style="color:var(--text2);margin:0;">Nenhuma aula hoje.</p>`}
    </div>
  `;
}

function renderDashboardPage() {
  const role = decodeAuthToken()?.role;

  if (role === 'operacao') {
    document.getElementById('page-dashboard').innerHTML = `
      <div class="section-header">
        <div><h1>Dashboard</h1><p class="subtitle" style="margin:0;">Aulas de hoje em ${escapeHtml(data.meta.empresa)}</p></div>
      </div>
      ${renderAulasHojeCard()}
      ${renderProntosGraduarCard()}
      ${renderQuaseLaCard()}
    `;
    return;
  }

  const k = computeKPIs();
  const diag = computePlanejamentoDiagnostico();
  const dica = computeGestaoDica(k);
  const mesAtualLabel = monthLabel(currentYearMonth());
  const emRisco = computeAlunosEmRisco();

  document.getElementById('page-dashboard').innerHTML = `
    <div class="section-header">
      <div><h1>Dashboard</h1><p class="subtitle" style="margin:0;">Visão geral de ${escapeHtml(data.meta.empresa)} — resultado de ${mesAtualLabel}</p></div>
    </div>

    ${renderAulasHojeCard()}

    ${renderProntosGraduarCard()}
      ${renderQuaseLaCard()}

    <div class="card-grid card-grid-3" style="margin-bottom:16px;">
      <div class="kpi kpi-green">
        <div class="kpi-label">Entradas</div>
        <div class="kpi-value">${fmt(k.entradasMes)}</div>
        <div class="kpi-sub">${mesAtualLabel} · recebido + a receber</div>
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

    <div class="card-grid card-grid-2" style="margin-bottom:16px;">
      <div class="kpi kpi-green">
        <div class="kpi-label">Recebido no Mês</div>
        <div class="kpi-value">${fmt(k.entradasRecebidas)}</div>
        <div class="kpi-sub">${k.entradasMes > 0 ? Math.round(k.entradasRecebidas / k.entradasMes * 100) : 0}% das entradas já entraram no caixa</div>
      </div>
      <div class="kpi kpi-yellow">
        <div class="kpi-label">A Receber no Mês</div>
        <div class="kpi-value">${fmt(k.entradasAReceber)}</div>
        <div class="kpi-sub">ainda em aberto em ${mesAtualLabel}${k.entradasAReceber > 0 ? ` · <a href="#" style="color:var(--accent);font-weight:600;" onclick="irParaCobrancaDoMes();return false;">ver de onde vem</a>` : ''}</div>
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
            <thead><tr><th style="text-align:left;">Aluno</th><th>Última vez</th><th>Últimos 90 dias</th><th>Últimas 3 semanas</th><th>Ações</th></tr></thead>
            <tbody>${emRisco.slice(0, 8).map(({ student, risco }) => `
              <tr>
                <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
                <td data-label="Última vez" class="${risco.diasSemTreinar >= 21 ? 'neg' : ''}">${risco.diasSemTreinar} dias atrás</td>
                <td data-label="Últimos 90 dias">${risco.aulas90} aula${risco.aulas90 === 1 ? '' : 's'}</td>
                <td data-label="Últimas 3 semanas" class="neg">${risco.aulas21} aula${risco.aulas21 === 1 ? '' : 's'}</td>
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
