/* ==========================================================================
   SIMULAÇÃO DE GANHOS — projeção de crescimento de alunos, MRR e receita,
   cruzada com o limite de capacidade do tatame (Turmas)
   ========================================================================== */

function avgTicket(categoria) {
  const alunos = activeStudents().filter(s => s.categoria === categoria && s.valorMensalidade > 0);
  const defaults = { Kids: 150, Adulto: 200, Particular: 300 };
  return alunos.length ? avg(alunos.map(s => s.valorMensalidade)) : (defaults[categoria] || 200);
}

function renderGanhosPage() {
  const kidsAtual = activeStudents().filter(s => s.categoria === 'Kids').length;
  const adultoAtual = activeStudents().filter(s => s.categoria === 'Adulto').length;
  const particularAtual = activeStudents().filter(s => s.categoria === 'Particular').length;
  const diag = computePlanejamentoDiagnostico();

  document.getElementById('page-ganhos').innerHTML = `
    <div class="section-header">
      <div><h1>Simulação de Ganhos</h1><p class="subtitle" style="margin:0;">Projete o crescimento de alunos e a receita recorrente (MRR) da academia</p></div>
    </div>

    <div class="alert alert-info">💡 A projeção considera o limite de capacidade do tatame calculado em <strong>Turmas &amp; Tatame</strong> (estouro estimado em ${isFinite(diag.estouroEm) ? diag.estouroEm.toFixed(0) : '—'} alunos ativos).</div>

    <div class="card-grid card-grid-2" style="margin-bottom:20px;">
      <div class="card">
        <h3>📈 Parâmetros de Crescimento</h3>
        <div class="form-grid">
          <div class="form-group"><label>Alunos Kids (atual)</label><input type="number" id="g-kids-atual" value="${kidsAtual}"></div>
          <div class="form-group"><label>Alunos Adulto (atual)</label><input type="number" id="g-adulto-atual" value="${adultoAtual}"></div>
          <div class="form-group"><label>Alunos Particular (atual)</label><input type="number" id="g-particular-atual" value="${particularAtual}"></div>
          <div class="form-group"><label>Novos Kids / mês</label><input type="number" id="g-novos-kids" value="1"></div>
          <div class="form-group"><label>Novos Adultos / mês</label><input type="number" id="g-novos-adulto" value="2"></div>
          <div class="form-group"><label>Novos Particular / mês</label><input type="number" id="g-novos-particular" value="0"></div>
          <div class="form-group"><label>Churn mensal (%)</label><input type="number" id="g-churn" value="3" step="0.5"></div>
          <div class="form-group"><label>Horizonte (meses)</label>
            <select id="g-horizonte"><option value="12">12 meses</option><option value="24">24 meses</option><option value="36">36 meses</option></select>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>💰 Ticket Médio</h3>
        <div class="form-grid">
          <div class="form-group"><label>Mensalidade Kids (R$)</label><input type="text" inputmode="decimal" id="g-ticket-kids" value="${formatCurrencyValue(avgTicket('Kids'))}"></div>
          <div class="form-group"><label>Mensalidade Adulto (R$)</label><input type="text" inputmode="decimal" id="g-ticket-adulto" value="${formatCurrencyValue(avgTicket('Adulto'))}"></div>
          <div class="form-group"><label>Aula Particular (R$)</label><input type="text" inputmode="decimal" id="g-ticket-particular" value="${formatCurrencyValue(avgTicket('Particular'))}"></div>
          <div class="form-group"><label>Matrícula média (R$)</label><input type="text" inputmode="decimal" id="g-matricula" value="${formatCurrencyValue(150)}"></div>
          <div class="form-group"><label>Reajuste anual de preço (%)</label><input type="number" id="g-reajuste" value="0" step="0.5"></div>
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-primary" onclick="runGanhosSimulation()">▶ Simular Ganhos</button>
        </div>
      </div>
    </div>

    <div id="ganhos-result"></div>
  `;

  ['g-ticket-kids', 'g-ticket-adulto', 'g-ticket-particular', 'g-matricula'].forEach(id => maskCurrencyInput(document.getElementById(id)));
  runGanhosSimulation();
}

function runGanhosSimulation() {
  const kidsAtual = parseFloat(document.getElementById('g-kids-atual').value) || 0;
  const adultoAtual = parseFloat(document.getElementById('g-adulto-atual').value) || 0;
  const particularAtual = parseFloat(document.getElementById('g-particular-atual').value) || 0;
  const novosKids = parseFloat(document.getElementById('g-novos-kids').value) || 0;
  const novosAdulto = parseFloat(document.getElementById('g-novos-adulto').value) || 0;
  const novosParticular = parseFloat(document.getElementById('g-novos-particular').value) || 0;
  const churn = (parseFloat(document.getElementById('g-churn').value) || 0) / 100;
  const horizonte = parseInt(document.getElementById('g-horizonte').value) || 12;
  const ticketKidsBase = parseCurrencyValue(document.getElementById('g-ticket-kids').value);
  const ticketAdultoBase = parseCurrencyValue(document.getElementById('g-ticket-adulto').value);
  const ticketParticularBase = parseCurrencyValue(document.getElementById('g-ticket-particular').value);
  const matricula = parseCurrencyValue(document.getElementById('g-matricula').value);
  const reajuste = (parseFloat(document.getElementById('g-reajuste').value) || 0) / 100;

  const diag = computePlanejamentoDiagnostico();
  const capacidadeTotal = isFinite(diag.estouroEm) ? diag.estouroEm : null;

  let kids = kidsAtual, adulto = adultoAtual, particular = particularAtual;
  const months = [];
  let rupturaMes = null;
  let receitaAcumulada = 0;

  for (let i = 1; i <= horizonte; i++) {
    kids = kids * (1 - churn) + novosKids;
    adulto = adulto * (1 - churn) + novosAdulto;
    particular = particular * (1 - churn) + novosParticular;
    const totalAlunos = kids + adulto + particular;
    const anosPassados = Math.floor((i - 1) / 12);
    const ticketKids = ticketKidsBase * Math.pow(1 + reajuste, anosPassados);
    const ticketAdulto = ticketAdultoBase * Math.pow(1 + reajuste, anosPassados);
    const ticketParticular = ticketParticularBase * Math.pow(1 + reajuste, anosPassados);
    const mrr = kids * ticketKids + adulto * ticketAdulto + particular * ticketParticular;
    const receitaMatriculas = (novosKids + novosAdulto + novosParticular) * matricula;
    const receitaTotal = mrr + receitaMatriculas;
    receitaAcumulada += receitaTotal;

    if (capacidadeTotal !== null && totalAlunos >= capacidadeTotal && rupturaMes === null) rupturaMes = i;

    months.push({ i, kids, adulto, particular, totalAlunos, mrr, receitaMatriculas, receitaTotal, receitaAcumulada });
  }

  const ultimo = months[months.length - 1];
  const primeiro = months[0];

  const box = document.getElementById('ganhos-result');
  box.innerHTML = `
    <div class="card-grid card-grid-4" style="margin-bottom:20px;">
      <div class="kpi kpi-accent"><div class="kpi-label">Alunos Projetados (${horizonte}m)</div><div class="kpi-value">${ultimo.totalAlunos.toFixed(0)}</div><div class="kpi-sub">Hoje: ${(kidsAtual+adultoAtual+particularAtual).toFixed(0)}</div></div>
      <div class="kpi kpi-green"><div class="kpi-label">MRR Projetado (${horizonte}m)</div><div class="kpi-value">${fmt(ultimo.mrr)}</div><div class="kpi-sub">Hoje: ${fmt(primeiro.mrr)}</div></div>
      <div class="kpi kpi-green"><div class="kpi-label">Receita Acumulada</div><div class="kpi-value">${fmt(ultimo.receitaAcumulada)}</div><div class="kpi-sub">${horizonte} meses</div></div>
      <div class="kpi ${rupturaMes ? 'kpi-red' : 'kpi-green'}"><div class="kpi-label">Limite do Tatame</div><div class="kpi-value">${rupturaMes ? 'Mês ' + rupturaMes : 'Não atingido'}</div><div class="kpi-sub">${capacidadeTotal ? 'Capacidade: ' + capacidadeTotal.toFixed(0) + ' alunos' : 'Sem limite definido'}</div></div>
    </div>

    ${rupturaMes ? `<div class="alert alert-warning">⚠️ No mês <strong>${rupturaMes}</strong> a base de alunos ativos projetada atinge o ponto de estouro do tatame no horário de pico. Planeje um novo tatame/horário antes desse período — veja <strong>Turmas &amp; Tatame</strong>.</div>` : ''}

    <div class="card-grid card-grid-2" style="margin-bottom:20px;">
      <div class="card">
        <h3>Evolução de Alunos Ativos</h3>
        <div class="bar-chart" id="ganhos-chart-alunos" style="height:160px;"></div>
      </div>
      <div class="card">
        <h3>Evolução da Receita Recorrente (MRR)</h3>
        <div class="bar-chart" id="ganhos-chart-mrr" style="height:160px;"></div>
      </div>
    </div>

    <div class="card">
      <h3>Tabela de Projeção</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Mês</th><th>Kids</th><th>Adulto</th><th>Particular</th><th>Total Alunos</th><th>MRR</th><th>Matrículas</th><th>Receita do Mês</th><th>Receita Acum.</th></tr></thead>
          <tbody>${months.map(m => `<tr>
            <td>${m.i}</td><td>${m.kids.toFixed(1)}</td><td>${m.adulto.toFixed(1)}</td><td>${m.particular.toFixed(1)}</td>
            <td style="font-weight:700;">${m.totalAlunos.toFixed(1)}</td>
            <td class="pos">${fmtFull(m.mrr)}</td><td class="pos">${fmtFull(m.receitaMatriculas)}</td>
            <td class="pos" style="font-weight:700;">${fmtFull(m.receitaTotal)}</td><td>${fmtFull(m.receitaAcumulada)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;

  const stepLabels = months.map(m => 'M' + m.i);
  renderBarChart('ganhos-chart-alunos', [{ values: months.map(m => m.totalAlunos), color: 'var(--accent)' }], stepLabels, { height: 160 });
  renderBarChart('ganhos-chart-mrr', [{ values: months.map(m => m.mrr), color: 'var(--green)' }], stepLabels, { height: 160 });
}
