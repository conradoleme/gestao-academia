/* ==========================================================================
   CENÁRIOS & PROJEÇÃO — motor original do Simulador de Fluxo de Caixa,
   agora alimentado automaticamente pelos lançamentos reais do Fluxo de Caixa
   (com opção de importar/editar manualmente via CSV, como antes).
   ========================================================================== */

let simData = [];
let simAnalysis = null;
let simScenarios = [];
let simActiveScenario = 0;

function renderSimuladorPage() {
  document.getElementById('page-simulador').innerHTML = `
    <div class="section-header">
      <div><h1>Cenários &amp; Projeção</h1><p class="subtitle" style="margin:0;">Diagnóstico automático, identificação de gargalos e simulação de cenários para 12 meses</p></div>
    </div>

    <div class="tabs" id="sim-tabs" style="margin-bottom:24px;">
      <button class="tab active" onclick="showSimPage('input')" id="simnav-input">Dados</button>
      <button class="tab" onclick="showSimPage('diagnostico')" id="simnav-diagnostico">Diagnóstico</button>
      <button class="tab" onclick="showSimPage('restricao')" id="simnav-restricao">Gargalo</button>
      <button class="tab" onclick="showSimPage('parametros')" id="simnav-parametros">Parâmetros</button>
      <button class="tab" onclick="showSimPage('cenarios')" id="simnav-cenarios">Cenários</button>
      <button class="tab" onclick="showSimPage('projecao')" id="simnav-projecao">Projeção 12M</button>
      <button class="tab" onclick="showSimPage('recomendacao')" id="simnav-recomendacao">Recomendação</button>
      <button class="tab" onclick="showSimPage('painel')" id="simnav-painel">Dashboard</button>
    </div>

    <div id="simpage-input" class="sim-page active">
      <div class="alert alert-info">💡 Os dados abaixo são gerados automaticamente a partir dos lançamentos reais em <strong>Fluxo de Caixa</strong>. Você também pode importar/editar manualmente para simular cenários hipotéticos.</div>

      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h3 style="margin:0;">Origem dos Dados</h3>
          <div class="btn-row" style="margin:0;">
            <button class="btn btn-secondary" onclick="loadDataFromLedger()">🔄 Recarregar do Fluxo de Caixa</button>
            <button class="btn btn-secondary" onclick="loadSampleData()">📋 Carregar Exemplo</button>
            <button class="btn btn-secondary" onclick="clearSimData()">🗑️ Limpar</button>
          </div>
        </div>
        <hr class="divider">
        <h3>Importar Dados (CSV rápido)</h3>
        <p style="color:var(--text2);font-size:12px;margin-bottom:10px;">Formato: <code>Mês,Receita,Aportes/Reembolsos,Rendimentos,Despesas</code> — uma linha por mês</p>
        <textarea id="csv-input" placeholder="Jan/24,50000,0,500,48000&#10;Fev/24,52000,0,520,47500"></textarea>
        <div class="btn-row"><button class="btn btn-primary" onclick="importCSV()">📥 Importar CSV</button></div>
      </div>

      <div class="card">
        <h3>Tabela de Dados Mensais</h3>
        <div class="table-wrap">
          <table class="input-table">
            <thead><tr><th>Mês</th><th>Receita (R$)</th><th>Aportes/Reembolsos (R$)</th><th>Rendimentos (R$)</th><th>Despesas (R$)</th><th>Resultado</th></tr></thead>
            <tbody id="sim-input-body"></tbody>
          </table>
        </div>
        <button class="btn btn-secondary" onclick="addSimRow()" style="margin-top:12px;">+ Adicionar Mês</button>
      </div>

      <div class="btn-row" style="margin-top:20px;"><button class="btn btn-primary" onclick="runAnalysis()" style="font-size:14px;">▶ Analisar Agora</button></div>
    </div>

    <div id="simpage-diagnostico" class="sim-page">
      <div id="diag-alert"></div>
      <div class="card-grid card-grid-4" style="margin-bottom:24px;" id="kpi-grid"></div>
      <div class="card-grid card-grid-2" style="margin-bottom:24px;">
        <div class="card"><h3>Evolução de Receitas vs Despesas</h3><div class="bar-chart" id="chart-receita-desp" style="height:140px;"></div></div>
        <div class="card"><h3>Resultado Mensal</h3><div class="bar-chart" id="chart-resultado" style="height:140px;"></div></div>
      </div>
      <div class="card"><h3>Classificação da Situação</h3><div id="situacao-box"></div></div>
    </div>

    <div id="simpage-restricao" class="sim-page"><div id="restricao-content"></div></div>

    <div id="simpage-parametros" class="sim-page">
      <div class="card-grid card-grid-2">
        <div class="card"><h3>📈 Receita</h3><div style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group"><label>Crescimento Mensal (%)</label><div class="slider-row"><input type="range" id="s-receita-cresc" min="-10" max="30" value="0" step="0.5" oninput="updateSlider(this,'s-receita-cresc-val','%')"><span class="slider-val" id="s-receita-cresc-val">0%</span></div></div>
          <div class="form-group"><label>Novos Clientes — Receita Adicional Mensal (R$)</label><input type="number" id="s-novos-clientes" value="0"></div>
          <div class="form-group"><label>Reajuste de Preços (%)</label><div class="slider-row"><input type="range" id="s-reajuste" min="0" max="30" value="0" step="0.5" oninput="updateSlider(this,'s-reajuste-val','%')"><span class="slider-val" id="s-reajuste-val">0%</span></div></div>
        </div></div>
        <div class="card"><h3>💸 Despesas</h3><div style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group"><label>Redução de Custos (%)</label><div class="slider-row"><input type="range" id="s-reduz-custo" min="0" max="40" value="0" step="0.5" oninput="updateSlider(this,'s-reduz-custo-val','%')"><span class="slider-val" id="s-reduz-custo-val">0%</span></div></div>
          <div class="form-group"><label>Corte de Despesas Fixas (R$/mês)</label><input type="number" id="s-corte-desp" value="0"></div>
          <div class="form-group"><label>Ganho de Eficiência Operacional (%)</label><div class="slider-row"><input type="range" id="s-eficiencia" min="0" max="30" value="0" step="0.5" oninput="updateSlider(this,'s-eficiencia-val','%')"><span class="slider-val" id="s-eficiencia-val">0%</span></div></div>
        </div></div>
        <div class="card"><h3>💰 Capital</h3><div style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group"><label>Aporte de Investidor (R$)</label><input type="number" id="s-aporte" value="0"></div>
          <div class="form-group"><label>Mês do Aporte</label><select id="s-aporte-mes"><option value="1">Mês 1</option><option value="2">Mês 2</option><option value="3">Mês 3</option><option value="4">Mês 4</option><option value="5">Mês 5</option><option value="6">Mês 6</option></select></div>
          <div class="form-group"><label>Empréstimo (R$)</label><input type="number" id="s-emprestimo" value="0"></div>
          <div class="form-group"><label>Taxa de Juros do Empréstimo (% a.m.)</label><input type="number" id="s-juros" value="2" step="0.1"></div>
        </div></div>
        <div class="card"><h3>⚙️ Operação</h3><div style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group"><label>Aumento de Produtividade (%)</label><div class="slider-row"><input type="range" id="s-produt" min="0" max="50" value="0" step="1" oninput="updateSlider(this,'s-produt-val','%')"><span class="slider-val" id="s-produt-val">0%</span></div></div>
          <div class="form-group"><label>Redução de Desperdícios (%)</label><div class="slider-row"><input type="range" id="s-desperdicio" min="0" max="30" value="0" step="0.5" oninput="updateSlider(this,'s-desperdicio-val','%')"><span class="slider-val" id="s-desperdicio-val">0%</span></div></div>
          <div class="form-group"><label>Automação — Economia Mensal (R$)</label><input type="number" id="s-automacao" value="0"></div>
        </div></div>
      </div>
      <div class="btn-row" style="margin-top:24px;">
        <button class="btn btn-primary" onclick="runSimulation()">▶ Simular Cenário Personalizado</button>
        <button class="btn btn-secondary" onclick="resetSimulation()">↺ Resetar</button>
      </div>
      <div id="sim-result" style="margin-top:24px;"></div>
    </div>

    <div id="simpage-cenarios" class="sim-page">
      <div id="cenarios-grid" class="card-grid" style="grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;"></div>
      <div class="card"><h3>Comparativo de Cenários — Caixa Acumulado 12M</h3><div class="bar-chart" id="chart-cenarios" style="height:180px;"></div></div>
    </div>

    <div id="simpage-projecao" class="sim-page">
      <div class="tabs" id="proj-tabs"></div>
      <div class="card-grid card-grid-4" id="proj-kpis" style="margin-bottom:24px;"></div>
      <div class="card" style="margin-bottom:20px;"><h3>Fluxo de Caixa Mensal Projetado</h3><div class="proj-chart" id="proj-chart" style="height:180px;"></div></div>
      <div class="card"><h3>Tabela de Projeção Detalhada</h3><div class="table-wrap"><table>
        <thead><tr><th>Mês</th><th>Receita</th><th>Aportes</th><th>Rend.</th><th>Despesa</th><th>Resultado</th><th>Acumulado</th><th>Status</th></tr></thead>
        <tbody id="proj-table"></tbody>
      </table></div></div>
    </div>

    <div id="simpage-recomendacao" class="sim-page"><div id="recomendacao-content"></div></div>

    <div id="simpage-painel" class="sim-page">
      <div class="card" style="margin-bottom:24px;"><h3>Comparativo de Cenários</h3><div class="table-wrap"><table>
        <thead><tr><th style="text-align:left;">Cenário</th><th>Receita Anual</th><th>Despesa Anual</th><th>Caixa Final</th><th>Cap. Externo</th><th>Retorno</th><th>Risco</th><th>Posição</th></tr></thead>
        <tbody id="dashboard-table"></tbody>
      </table></div></div>
      <div class="card"><h3>Parecer Executivo</h3><div id="parecer-exec" class="exec-box"></div></div>
    </div>
  `;

  loadDataFromLedger();
}

function showSimPage(id) {
  document.querySelectorAll('.sim-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sim-tabs .tab').forEach(b => b.classList.remove('active'));
  document.getElementById('simpage-' + id).classList.add('active');
  document.getElementById('simnav-' + id).classList.add('active');
}

/* ---------------- Origem dos dados: ledger real ---------------- */
function loadDataFromLedger() {
  const months = allMonthsWithData();
  if (months.length === 0) {
    simData = [];
    buildSimInputTable();
    showToast('Nenhum lançamento no Fluxo de Caixa ainda — cadastre alunos/lançamentos ou carregue um exemplo.', 'info');
    return;
  }
  simData = months.map(mk => {
    const s = getMonthSummary(mk);
    return {
      mes: monthLabel(mk),
      receita: s.byGroup.receita.total,
      aportes: 0,
      rendimentos: s.byGroup.receitaFinanceira.total,
      despesas: s.totalSaidas,
    };
  });
  buildSimInputTable();
  showToast(`${months.length} mês(es) carregado(s) do Fluxo de Caixa.`);
}

/* ---------------- Tabela de entrada ---------------- */
function buildSimInputTable() {
  const tbody = document.getElementById('sim-input-body');
  if (!tbody) return;
  tbody.innerHTML = simData.map((row, i) => {
    const receita = row.receita || 0, aportes = row.aportes || 0, rendimentos = row.rendimentos || 0, despesas = row.despesas || 0;
    const resultado = receita + aportes + rendimentos - despesas;
    const cls = resultado >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td><input type="text" value="${row.mes}" onchange="updateSimRow(${i},'mes',this.value)" style="text-align:left;font-weight:600;"></td>
      <td><input type="number" value="${receita}" onchange="updateSimRow(${i},'receita',this.value)"></td>
      <td><input type="number" value="${aportes}" onchange="updateSimRow(${i},'aportes',this.value)"></td>
      <td><input type="number" value="${rendimentos}" onchange="updateSimRow(${i},'rendimentos',this.value)"></td>
      <td><input type="number" value="${despesas}" onchange="updateSimRow(${i},'despesas',this.value)"></td>
      <td class="${cls}" style="font-weight:700;font-size:13px;">${fmt(resultado)}</td>
    </tr>`;
  }).join('');
}
function updateSimRow(i, field, val) {
  simData[i][field] = field === 'mes' ? val : parseFloat(String(val).replace(',','.')) || 0;
  buildSimInputTable();
}
function addSimRow() {
  const mesIdx = simData.length % 12;
  const yr = 24 + Math.floor(simData.length / 12);
  simData.push({ mes: MESES_ABREV[mesIdx] + '/' + yr, receita: 0, aportes: 0, rendimentos: 0, despesas: 0 });
  buildSimInputTable();
}
function importCSV() {
  const raw = document.getElementById('csv-input').value.trim();
  if (!raw) { showToast('Cole o CSV no campo acima antes de importar.', 'error'); return; }
  simData = [];
  raw.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line) return;
    const parts = line.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      simData.push({ mes: parts[0], receita: parseFloat(parts[1])||0, aportes: parseFloat(parts[2])||0, rendimentos: parseFloat(parts[3])||0, despesas: parseFloat(parts[4])||0 });
    }
  });
  if (simData.length === 0) { showToast('Nenhuma linha válida encontrada.', 'error'); return; }
  buildSimInputTable();
  showToast(simData.length + ' meses importados!');
}
function loadSampleData() {
  simData = [
    {mes:'Jan/24',receita:8500,aportes:0,rendimentos:85,despesas:9200},
    {mes:'Fev/24',receita:8800,aportes:1500,rendimentos:90,despesas:9400},
    {mes:'Mar/24',receita:9200,aportes:0,rendimentos:92,despesas:9600},
    {mes:'Abr/24',receita:9500,aportes:0,rendimentos:95,despesas:9800},
    {mes:'Mai/24',receita:9800,aportes:2000,rendimentos:98,despesas:10100},
    {mes:'Jun/24',receita:10200,aportes:0,rendimentos:102,despesas:10300},
    {mes:'Jul/24',receita:10500,aportes:0,rendimentos:105,despesas:10600},
    {mes:'Ago/24',receita:10800,aportes:0,rendimentos:108,despesas:10850},
    {mes:'Set/24',receita:11200,aportes:0,rendimentos:112,despesas:11000},
    {mes:'Out/24',receita:11500,aportes:0,rendimentos:115,despesas:11200},
    {mes:'Nov/24',receita:11800,aportes:0,rendimentos:118,despesas:11400},
    {mes:'Dez/24',receita:12200,aportes:0,rendimentos:122,despesas:11600},
  ];
  buildSimInputTable();
}
function clearSimData() { simData = []; buildSimInputTable(); }

/* ---------------- Análise ---------------- */
function runAnalysis() {
  if (simData.length < 2) { showToast('Insira pelo menos 2 meses de dados antes de analisar.', 'error'); showSimPage('input'); return; }

  const receitas = simData.map(d => d.receita), despesas = simData.map(d => d.despesas);
  const aportes = simData.map(d => d.aportes), rendimentos = simData.map(d => d.rendimentos);
  const resultados = simData.map(d => d.receita + d.aportes + d.rendimentos - d.despesas);

  const totalReceita = receitas.reduce((a,b)=>a+b,0), totalDesp = despesas.reduce((a,b)=>a+b,0);
  const totalAportes = aportes.reduce((a,b)=>a+b,0), totalRend = rendimentos.reduce((a,b)=>a+b,0);
  const totalResult = resultados.reduce((a,b)=>a+b,0);
  const mesesDefi = resultados.filter(r=>r<0).length, mesesSuper = resultados.filter(r=>r>=0).length;
  const melhorMes = simData[resultados.indexOf(Math.max(...resultados))];
  const piorMes = simData[resultados.indexOf(Math.min(...resultados))];
  const receitaGrowth = receitas.length >= 2 && receitas[0] ? ((receitas[receitas.length-1] - receitas[0]) / receitas[0]) * 100 : 0;
  const despGrowth = despesas.length >= 2 && despesas[0] ? ((despesas[despesas.length-1] - despesas[0]) / despesas[0]) * 100 : 0;
  const avgResult = avg(resultados);
  const stdDev = Math.sqrt(resultados.map(r => Math.pow(r - avgResult, 2)).reduce((a,b)=>a+b,0) / resultados.length);
  const aporteDep = totalReceita > 0 ? (totalAportes / totalReceita) * 100 : 0;

  let situacao, situacaoCls;
  if (receitaGrowth > 10 && totalResult > 0 && mesesDefi === 0) { situacao = 'Crescimento Saudável'; situacaoCls = 'tag-green'; }
  else if (receitaGrowth > 5 && mesesDefi > 0) { situacao = 'Crescimento com Consumo de Caixa'; situacaoCls = 'tag-yellow'; }
  else if (aporteDep > 20) { situacao = 'Dependência de Capital Externo'; situacaoCls = 'tag-red'; }
  else if (mesesDefi > simData.length * 0.5) { situacao = 'Operação Deficitária'; situacaoCls = 'tag-red'; }
  else if (Math.abs(receitaGrowth) < 5) { situacao = 'Estagnação'; situacaoCls = 'tag-yellow'; }
  else { situacao = 'Crescimento Saudável'; situacaoCls = 'tag-green'; }

  let restricao, restricaoTipo, restricaoImpacto, restricaoDesc, restricaoAcao;
  const despGrowthFasterThanReceita = despGrowth > receitaGrowth + 5;
  const receitaInsuficiente = avg(receitas) < avg(despesas);
  const altaDependenciaAporte = aporteDep > 15;
  const altaVolatilidade = stdDev > avg(receitas) * 0.15;

  if (altaDependenciaAporte) {
    restricao = 'Restrição Financeira'; restricaoTipo = 'Financeira';
    restricaoDesc = 'A academia depende de aportes externos para operar. O caixa gerado pela operação (mensalidades e serviços) não é suficiente para cobrir as despesas recorrentes.';
    restricaoImpacto = totalAportes;
    restricaoAcao = 'Aumentar receita recorrente (mensalidades ativas) e reduzir dependência de aportes. Foco em retenção de alunos e novas matrículas.';
  } else if (receitaInsuficiente || mesesDefi > simData.length * 0.4) {
    restricao = 'Restrição Comercial'; restricaoTipo = 'Comercial';
    restricaoDesc = 'A receita gerada por mensalidades e matrículas é insuficiente para cobrir as despesas operacionais. O gargalo está no número de alunos ativos ou no ticket médio praticado.';
    restricaoImpacto = Math.abs(avg(receitas) - avg(despesas)) * 12;
    restricaoAcao = 'Aumentar o número de alunos ativos (ver Simulação de Ganhos) ou revisar o valor das mensalidades.';
  } else if (despGrowthFasterThanReceita) {
    restricao = 'Restrição Operacional'; restricaoTipo = 'Operacional';
    restricaoDesc = 'As despesas crescem mais rapidamente que as receitas, comprimindo a margem. Custos fixos (aluguel, colaboradores) ou variáveis estão consumindo o crescimento.';
    restricaoImpacto = (despGrowth - receitaGrowth) / 100 * avg(despesas) * 12;
    restricaoAcao = 'Mapear despesas operacionais e de CTV que crescem sem gerar retorno proporcional em alunos ou receita.';
  } else if (altaVolatilidade) {
    restricao = 'Restrição de Gestão'; restricaoTipo = 'Gestão';
    restricaoDesc = 'Alta volatilidade entre os meses indica falta de previsibilidade — possível concentração de matrículas em poucos meses ou sazonalidade não gerenciada.';
    restricaoImpacto = stdDev * 12;
    restricaoAcao = 'Padronizar vencimentos de mensalidade, reduzir inadimplência e diversificar captação de alunos ao longo do ano.';
  } else {
    restricao = 'Restrição de Mercado'; restricaoTipo = 'Mercado';
    restricaoDesc = 'A academia opera de forma relativamente eficiente, mas o crescimento pode estar limitado pela capacidade física do tatame ou pelo tamanho do mercado local.';
    restricaoImpacto = avg(receitas) * 0.3 * 12;
    restricaoAcao = 'Avaliar abertura de novas turmas/horários (ver Turmas & Tatame) ou expansão para novos públicos (kids, aulas particulares).';
  }

  simAnalysis = { receitas, despesas, aportes, rendimentos, resultados, totalReceita, totalDesp, totalAportes, totalRend, totalResult,
    mesesDefi, mesesSuper, melhorMes, piorMes, receitaGrowth, despGrowth, avgResult, stdDev, aporteDep,
    situacao, situacaoCls, restricao, restricaoTipo, restricaoImpacto, restricaoDesc, restricaoAcao,
    avgReceita: avg(receitas), avgDesp: avg(despesas) };

  buildSimScenarios();
  renderSimDiagnostico();
  renderSimRestricao();
  renderSimCenarios();
  renderSimProjecao();
  renderSimRecomendacao();
  renderSimDashboard();
  showSimPage('diagnostico');
}

function buildSimScenarios() {
  const a = simAnalysis;
  const baseReceita = a.avgReceita, baseDesp = a.avgDesp;
  function project(params, name) {
    const months = [];
    let receita = baseReceita * (1 + (params.receitaBoost || 0) / 100);
    let desp = baseDesp * (1 - (params.despReducao || 0) / 100);
    let acum = 0;
    for (let i = 0; i < 12; i++) {
      receita *= (1 + (params.crescMensal || 0) / 100);
      const aporteEm = (i + 1 === (params.aporteMes || 1)) ? (params.aporte || 0) : 0;
      const emprestimo = (i === 0) ? (params.emprestimo || 0) : 0;
      const jurosDesp = i > 0 ? (params.emprestimo || 0) * (params.juros || 0) / 100 : 0;
      const despTotal = desp + jurosDesp - (params.corteMensal || 0);
      const rend = receita * 0.01;
      const resultado = receita + aporteEm + rend + emprestimo - despTotal;
      acum += resultado;
      months.push({ mes: MESES_ABREV[i], receita, aportes: aporteEm, rendimentos: rend, despesas: despTotal, resultado, acum });
    }
    return { name, months, totalReceita: months.reduce((s,m)=>s+m.receita,0), totalDesp: months.reduce((s,m)=>s+m.despesas,0), caixaFinal: acum, capitalExterno: (params.aporte||0)+(params.emprestimo||0), params };
  }
  simScenarios = [
    project({ crescMensal: 0 }, 'Base Atual'),
    project({ crescMensal: 0, despReducao: 0, aporte: 0, emprestimo: 0 }, 'Autofinanciamento'),
    project({ crescMensal: 0, despReducao: 12, corteMensal: 200 }, 'Eficiência Operacional'),
    project({ crescMensal: 2.5, receitaBoost: 15 }, 'Crescimento de Alunos'),
    project({ aporte: 15000, aporteMes: 1, crescMensal: 1 }, 'Investimento Externo'),
    project({ despReducao: 10, crescMensal: 1.5, receitaBoost: 10 }, 'Melhor Alocação de Recursos'),
  ];
}

/* ---------------- Renders (diagnóstico, restrição, cenários, projeção, recomendação, dashboard) ---------------- */
function renderSimDiagnostico() {
  const a = simAnalysis;
  const alertBox = document.getElementById('diag-alert');
  alertBox.innerHTML = a.mesesDefi > 0
    ? `<div class="alert alert-warning">⚠️ <strong>${a.mesesDefi} mês(es) deficitário(s)</strong> identificado(s) no histórico.</div>`
    : `<div class="alert alert-success">✅ Todos os meses apresentaram resultado positivo no período analisado.</div>`;

  const kpiData = [
    { label: 'Receita Média Mensal', value: fmt(a.avgReceita), sub: `Total: ${fmt(a.totalReceita)}`, cls: 'kpi-green' },
    { label: 'Despesa Média Mensal', value: fmt(a.avgDesp), sub: `Total: ${fmt(a.totalDesp)}`, cls: 'kpi-red' },
    { label: 'Resultado Médio Mensal', value: fmt(a.avgResult), sub: a.avgResult >= 0 ? '✅ Superávit' : '❌ Déficit', cls: a.avgResult >= 0 ? 'kpi-green' : 'kpi-red' },
    { label: 'Dependência de Aportes', value: a.aporteDep.toFixed(1) + '%', sub: `Total: ${fmt(a.totalAportes)}`, cls: a.aporteDep > 15 ? 'kpi-red' : 'kpi-yellow' },
    { label: 'Crescimento Receita', value: fmtPct(a.receitaGrowth), sub: 'Período completo', cls: a.receitaGrowth > 0 ? 'kpi-green' : 'kpi-red' },
    { label: 'Crescimento Despesas', value: fmtPct(a.despGrowth), sub: 'Período completo', cls: a.despGrowth > a.receitaGrowth ? 'kpi-red' : 'kpi-accent' },
    { label: 'Volatilidade do Caixa', value: fmt(a.stdDev), sub: 'Desvio padrão', cls: a.stdDev > a.avgReceita*0.15 ? 'kpi-red' : 'kpi-yellow' },
    { label: 'Meses Superavitários', value: a.mesesSuper + '/' + simData.length, sub: `${a.mesesDefi} deficitários`, cls: a.mesesDefi === 0 ? 'kpi-green' : 'kpi-yellow' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpiData.map(k => `<div class="kpi ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');

  renderBarChart('chart-receita-desp', [{ values: a.receitas, color: 'var(--green)' }, { values: a.despesas, color: 'var(--red)' }], simData.map(d => d.mes.split('/')[0]));
  renderBarChart('chart-resultado', [{ values: a.resultados.map(r=>r>=0?r:0), color: 'var(--green)' }, { values: a.resultados.map(r=>r<0?Math.abs(r):0), color: 'var(--red)' }], simData.map(d => d.mes.split('/')[0]));

  document.getElementById('situacao-box').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;"><span class="tag ${a.situacaoCls}" style="font-size:14px;padding:6px 16px;">${a.situacao}</span></div>
    <div class="card-grid card-grid-2" style="gap:12px;">
      <div style="padding:14px;background:var(--surface2);border-radius:8px;"><div style="font-size:11px;color:var(--text2);margin-bottom:4px;">MELHOR MÊS</div><div style="font-weight:700;">${a.melhorMes?.mes||'—'}</div><div class="pos">${fmt(Math.max(...a.resultados))}</div></div>
      <div style="padding:14px;background:var(--surface2);border-radius:8px;"><div style="font-size:11px;color:var(--text2);margin-bottom:4px;">PIOR MÊS</div><div style="font-weight:700;">${a.piorMes?.mes||'—'}</div><div class="neg">${fmt(Math.min(...a.resultados))}</div></div>
    </div>`;
}

function renderSimRestricao() {
  const a = simAnalysis;
  const icons = { Financeira:'💳', Comercial:'🛒', Operacional:'⚙️', Gestão:'📊', Mercado:'🌍' };
  const colors = { Financeira:'var(--red)', Comercial:'var(--yellow)', Operacional:'var(--accent)', Gestão:'var(--accent2)', Mercado:'var(--green)' };
  document.getElementById('restricao-content').innerHTML = `
    <div class="constraint-box" style="border-color:${colors[a.restricaoTipo]};margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">${icons[a.restricaoTipo]||'🎯'}</div>
      <div class="constraint-title" style="color:${colors[a.restricaoTipo]};">${a.restricao}</div>
      <div class="constraint-desc">${a.restricaoDesc}</div>
      <div class="constraint-impact"><div class="constraint-impact-title">Impacto Financeiro Estimado</div><div style="font-size:20px;font-weight:700;">${fmtFull(a.restricaoImpacto)} / ano</div></div>
    </div>
    <div class="card">
      <h3>Ação Recomendada</h3>
      <div style="padding:16px;background:rgba(108,99,255,0.08);border-radius:8px;border-left:3px solid var(--accent);font-size:13px;line-height:1.7;color:var(--text);">${a.restricaoAcao}</div>
    </div>`;
}

function renderSimCenarios() {
  const bestIdx = simScenarios.reduce((bi,s,i) => s.caixaFinal > simScenarios[bi].caixaFinal ? i : bi, 0);
  document.getElementById('cenarios-grid').innerHTML = simScenarios.map((s,i) => `
    <div class="scenario-card ${i===bestIdx?'best':''}" onclick="showSimScenario(${i})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;"><div class="scenario-name">${s.name}</div>${i===bestIdx?'<span class="tag tag-green">Melhor</span>':''}</div>
      <div class="scenario-num ${s.caixaFinal>=0?'pos':'neg'}">${fmt(s.caixaFinal)}</div>
      <div style="font-size:11px;color:var(--text2);">Caixa Acumulado 12M</div><hr class="divider">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div><div style="color:var(--text2);">Receita</div><div>${fmt(s.totalReceita)}</div></div>
        <div><div style="color:var(--text2);">Despesa</div><div>${fmt(s.totalDesp)}</div></div>
        <div><div style="color:var(--text2);">Cap. Externo</div><div>${fmt(s.capitalExterno)}</div></div>
        <div><div style="color:var(--text2);">Retorno</div><div>${s.capitalExterno>0?((s.caixaFinal/s.capitalExterno)*100).toFixed(0)+'%':'—'}</div></div>
      </div>
    </div>`).join('');
  const maxCaixa = Math.max(1, ...simScenarios.map(s=>Math.abs(s.caixaFinal)));
  document.getElementById('chart-cenarios').innerHTML = simScenarios.map(s => {
    const h = Math.max(4, (Math.abs(s.caixaFinal)/maxCaixa)*140);
    const color = s.caixaFinal>=0?'var(--green)':'var(--red)';
    return `<div class="bar-wrap"><div class="bar-val ${s.caixaFinal>=0?'pos':'neg'}">${fmt(s.caixaFinal)}</div><div class="bar" style="height:${h}px;background:${color};width:100%;"></div><div class="bar-label" style="font-size:9px;text-align:center;">${s.name.split(' ').join('\n')}</div></div>`;
  }).join('');
}
function showSimScenario(i) { simActiveScenario = i; showSimPage('projecao'); renderSimProjecaoTab(i); }

function renderSimProjecao() {
  document.getElementById('proj-tabs').innerHTML = simScenarios.map((s,i) => `<button class="tab ${i===0?'active':''}" onclick="selectSimProjTab(${i})">${s.name}</button>`).join('');
  renderSimProjecaoTab(0);
}
function selectSimProjTab(i) {
  simActiveScenario = i;
  document.querySelectorAll('#proj-tabs .tab').forEach((t,idx) => t.classList.toggle('active', idx===i));
  renderSimProjecaoTab(i);
}
function renderSimProjecaoTab(i) {
  const s = simScenarios[i], months = s.months;
  const melhor = months.reduce((a,b)=>a.resultado>b.resultado?a:b);
  const pior = months.reduce((a,b)=>a.resultado<b.resultado?a:b);
  const ruptura = months.findIndex(m=>m.acum<0);
  document.getElementById('proj-kpis').innerHTML = [
    { label:'Caixa Acumulado 12M', value: fmt(s.caixaFinal), cls: s.caixaFinal>=0?'kpi-green':'kpi-red' },
    { label:'Melhor Mês Projetado', value: melhor.mes, sub: fmt(melhor.resultado), cls:'kpi-green' },
    { label:'Mês de Maior Risco', value: pior.mes, sub: fmt(pior.resultado), cls:'kpi-red' },
    { label:'Ponto de Ruptura', value: ruptura>=0?'Mês '+(ruptura+1):'Não Detectado', sub: ruptura>=0?'⚠️ Risco de insolvência':'✅ Caixa positivo', cls: ruptura>=0?'kpi-red':'kpi-green' },
  ].map(k=>`<div class="kpi ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div>${k.sub?`<div class="kpi-sub">${k.sub}</div>`:''}</div>`).join('');
  const maxR = Math.max(1, ...months.map(m=>Math.abs(m.resultado)));
  document.getElementById('proj-chart').innerHTML = months.map(m => {
    const h = Math.max(4, (Math.abs(m.resultado)/maxR)*150);
    const color = m.resultado>=0?'var(--accent2)':'var(--red)';
    return `<div class="proj-bar-wrap"><div style="font-size:8px;color:${color};font-weight:600;">${fmt(m.resultado)}</div><div class="proj-bar" style="height:${h}px;background:${color};width:100%;"></div><div class="proj-label">${m.mes}</div></div>`;
  }).join('');
  document.getElementById('proj-table').innerHTML = months.map(m => `<tr>
    <td>${m.mes}</td><td class="pos">${fmtFull(m.receita)}</td><td class="${m.aportes>0?'neutral':''}">${m.aportes>0?fmtFull(m.aportes):'—'}</td>
    <td class="neutral">${fmtFull(m.rendimentos)}</td><td class="neg">${fmtFull(m.despesas)}</td>
    <td class="${m.resultado>=0?'pos':'neg'}" style="font-weight:700;">${fmtFull(m.resultado)}</td>
    <td class="${m.acum>=0?'pos':'neg'}">${fmtFull(m.acum)}</td>
    <td>${m.resultado>=0?'<span class="tag tag-green">Superávit</span>':'<span class="tag tag-red">Déficit</span>'}</td>
  </tr>`).join('');
}

function renderSimRecomendacao() {
  const a = simAnalysis;
  const bestS = simScenarios.reduce((b,s)=>s.caixaFinal>b.caixaFinal?s:b);
  const safeS = simScenarios.reduce((b,s) => {
    const defi = s.months.filter(m=>m.resultado<0).length, bDefi = b.months.filter(m=>m.resultado<0).length;
    return defi < bDefi ? s : b;
  });
  const bootstrap = simScenarios[1];
  const canBootstrap = bootstrap.caixaFinal > 0 && bootstrap.months.filter(m=>m.resultado<0).length === 0;
  const precisaInvest = simScenarios[0].months.filter(m=>m.resultado<0).length > 2;
  const qas = [
    ['1. Qual é a principal restrição financeira?', `<strong>${a.restricao}</strong>. ${a.restricaoDesc.split('.')[0]}.`],
    ['2. Qual ação gera maior impacto no caixa?', a.restricaoAcao],
    ['3. A academia precisa de investimento externo?', precisaInvest ? `⚠️ <strong>Sim, há indicadores de necessidade.</strong> O cenário base apresenta ${simScenarios[0].months.filter(m=>m.resultado<0).length} mês(es) deficitário(s).` : `✅ <strong>Não necessariamente.</strong> A operação demonstra capacidade de gerar caixa positivo sem capital externo.`],
    ['4. O crescimento pode ser autofinanciado?', canBootstrap ? `✅ <strong>Sim.</strong> O cenário de Autofinanciamento projeta caixa acumulado de <strong>${fmt(bootstrap.caixaFinal)}</strong> em 12 meses.` : `⚠️ <strong>Parcialmente.</strong> Viável apenas com redução de despesas ou aumento de receita antes do início da projeção.`],
    ['5. Qual cenário gera maior caixa acumulado?', `<strong>${bestS.name}</strong> — Caixa de ${fmt(bestS.caixaFinal)} em 12 meses.`],
    ['6. Qual cenário apresenta menor risco?', `<strong>${safeS.name}</strong> — Menor número de meses deficitários projetados.`],
    ['7. Qual cenário maximiza a geração de caixa?', `<strong>${simScenarios[5].name}</strong> — Direciona recursos para o gargalo identificado (${a.restricaoTipo}), gerando ${fmt(simScenarios[5].caixaFinal)} em 12 meses.`],
  ];
  document.getElementById('recomendacao-content').innerHTML = `<div class="exec-box">${qas.map(([q,a])=>`<div class="exec-item"><div class="exec-q">${q}</div><div class="exec-a">${a}</div></div>`).join('')}</div>`;
}

function renderSimDashboard() {
  const riskLabels = ['Alto','Médio-Alto','Médio','Médio-Baixo','Baixo','Mínimo'];
  const riskColors = ['neg','neg','neutral','neutral','pos','pos'];
  const rows = simScenarios.map((s,i) => {
    const defiCount = s.months.filter(m=>m.resultado<0).length;
    const riskScore = Math.min(5, defiCount + (s.capitalExterno>0?1:0));
    const roi = s.capitalExterno>0 ? ((s.caixaFinal/s.capitalExterno)*100).toFixed(0)+'%' : '—';
    const isBest = i === simScenarios.reduce((bi,sc,idx)=>sc.caixaFinal>simScenarios[bi].caixaFinal?idx:bi,0);
    return `<tr><td style="text-align:left;">${isBest?'🥇 ':''}${s.name}</td><td class="pos">${fmtFull(s.totalReceita)}</td><td class="neg">${fmtFull(s.totalDesp)}</td>
      <td class="${s.caixaFinal>=0?'pos':'neg'}" style="font-weight:700;">${fmtFull(s.caixaFinal)}</td>
      <td class="${s.capitalExterno>0?'neutral':'pos'}">${s.capitalExterno>0?fmtFull(s.capitalExterno):'—'}</td>
      <td>${roi}</td><td class="${riskColors[5-riskScore]}">${riskLabels[riskScore]}</td>
      <td>${isBest?'<span class="tag tag-green">★ Recomendado</span>':''}</td></tr>`;
  });
  document.getElementById('dashboard-table').innerHTML = rows.join('');

  const a = simAnalysis, bestS = simScenarios.reduce((b,s)=>s.caixaFinal>b.caixaFinal?s:b);
  const empresa = data.meta.empresa || 'A academia';
  document.getElementById('parecer-exec').innerHTML = `
    <div class="alert alert-info" style="margin-bottom:20px;">📋 <strong>Parecer Executivo</strong></div>
    <div style="font-size:14px;line-height:1.9;color:var(--text);">
      <p style="margin-bottom:12px;">${empresa} apresenta um histórico de <strong>${simData.length} meses</strong> analisados, com receita média de <strong>${fmt(a.avgReceita)}/mês</strong> e despesas médias de <strong>${fmt(a.avgDesp)}/mês</strong>, resultando em resultado operacional médio de <strong class="${a.avgResult>=0?'pos':'neg'}">${fmt(a.avgResult)}/mês</strong>.</p>
      <p style="margin-bottom:12px;">A análise identificou a <strong>${a.restricao}</strong> como principal gargalo financeiro, com impacto estimado de <strong>${fmtFull(a.restricaoImpacto)}/ano</strong> na geração de caixa potencial.</p>
      <p style="margin-bottom:12px;">Dentre os <strong>${simScenarios.length} cenários</strong> simulados para os próximos 12 meses, o <strong>${bestS.name}</strong> apresentou o melhor resultado, com caixa acumulado projetado de <strong class="${bestS.caixaFinal>=0?'pos':'neg'}">${fmtFull(bestS.caixaFinal)}</strong>.</p>
      <p style="margin-bottom:0;"><strong>Ação prioritária:</strong> ${a.restricaoAcao}</p>
    </div>`;
}

/* ---------------- Simulação personalizada (parâmetros livres) ---------------- */
function updateSlider(el, valId, suffix) { document.getElementById(valId).textContent = el.value + suffix; }

function runSimulation() {
  if (!simAnalysis) { showSimPage('input'); showToast('Execute a análise primeiro.', 'error'); return; }
  const params = {
    crescMensal: parseFloat(document.getElementById('s-receita-cresc').value)||0,
    receitaBoost: parseFloat(document.getElementById('s-reajuste').value)||0,
    novosClientes: parseFloat(document.getElementById('s-novos-clientes').value)||0,
    despReducao: parseFloat(document.getElementById('s-reduz-custo').value)||0,
    corteMensal: (parseFloat(document.getElementById('s-corte-desp').value)||0) + (parseFloat(document.getElementById('s-automacao').value)||0),
    eficiencia: parseFloat(document.getElementById('s-eficiencia').value)||0,
    aporte: parseFloat(document.getElementById('s-aporte').value)||0,
    aporteMes: parseInt(document.getElementById('s-aporte-mes').value)||1,
    emprestimo: parseFloat(document.getElementById('s-emprestimo').value)||0,
    juros: parseFloat(document.getElementById('s-juros').value)||2,
    produt: parseFloat(document.getElementById('s-produt').value)||0,
    desperdicio: parseFloat(document.getElementById('s-desperdicio').value)||0,
  };
  const a = simAnalysis;
  const months = [];
  let receita = a.avgReceita * (1+params.receitaBoost/100) * (1+params.produt/100);
  let desp = a.avgDesp * (1-params.despReducao/100) * (1-params.desperdicio/100) * (1-params.eficiencia/100);
  let acum = 0;
  for (let i=0;i<12;i++) {
    receita *= (1+params.crescMensal/100);
    const extraReceita = params.novosClientes;
    const aporteEm = (i+1===params.aporteMes) ? params.aporte : 0;
    const emprestimo = (i===0) ? params.emprestimo : 0;
    const jurosDesp = i>0 ? params.emprestimo*params.juros/100 : 0;
    const despTotal = desp - params.corteMensal + jurosDesp;
    const rend = receita*0.01;
    const resultado = receita+extraReceita+aporteEm+rend+emprestimo-despTotal;
    acum += resultado;
    months.push({ mes: MESES_ABREV[i], receita: receita+extraReceita, despesas: despTotal, resultado, acum });
  }
  const box = document.getElementById('sim-result');
  box.innerHTML = `
    <div class="card"><h3>Resultado da Simulação Personalizada</h3>
      <div class="card-grid card-grid-4" style="margin-bottom:16px;">
        <div class="kpi ${acum>=0?'kpi-green':'kpi-red'}"><div class="kpi-label">Caixa Acumulado 12M</div><div class="kpi-value">${fmtFull(acum)}</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Receita Total Anual</div><div class="kpi-value">${fmtFull(months.reduce((s,m)=>s+m.receita,0))}</div></div>
        <div class="kpi kpi-red"><div class="kpi-label">Despesa Total Anual</div><div class="kpi-value">${fmtFull(months.reduce((s,m)=>s+m.despesas,0))}</div></div>
        <div class="kpi kpi-accent"><div class="kpi-label">Meses Deficitários</div><div class="kpi-value">${months.filter(m=>m.resultado<0).length}/12</div></div>
      </div>
      <div class="bar-chart" style="height:120px;">${(() => {
        const maxR = Math.max(1, ...months.map(m=>Math.abs(m.resultado)));
        return months.map(m => {
          const h = Math.max(2, (Math.abs(m.resultado)/maxR)*96);
          const c = m.resultado>=0?'var(--accent2)':'var(--red)';
          return `<div class="bar-wrap"><div style="font-size:8px;color:${c};">${fmt(m.resultado)}</div><div class="bar" style="height:${h}px;background:${c};width:100%;"></div><div class="bar-label">${m.mes}</div></div>`;
        }).join('');
      })()}</div>
    </div>`;
}
function resetSimulation() {
  ['s-receita-cresc','s-reajuste','s-reduz-custo','s-eficiencia','s-produt','s-desperdicio'].forEach(id => {
    document.getElementById(id).value = 0;
    const valId = id+'-val';
    if (document.getElementById(valId)) document.getElementById(valId).textContent = '0%';
  });
  ['s-novos-clientes','s-corte-desp','s-aporte','s-emprestimo','s-automacao'].forEach(id => document.getElementById(id).value = 0);
  document.getElementById('s-juros').value = 2;
  document.getElementById('sim-result').innerHTML = '';
}
