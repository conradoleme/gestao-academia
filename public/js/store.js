/* ==========================================================================
   STORE — modelo de dados, persistência (API própria em Node/MySQL) e
   agregações.

   `data` é o mesmo objeto em memória de sempre (students, turmas,
   transactions, categoryGroups, cobrancaTemplates, meta) — a origem/destino
   dele é a nossa API REST (server/), autenticada por academia via JWT
   (ver public/js/api-client.js e public/js/auth.js).
   ========================================================================== */

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_SEMANA = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

const GROUP_META = {
  receita:               { label: 'Receita',                         tipo: 'entrada', color: 'var(--green)'  },
  receitaFinanceira:     { label: 'Receita Financeira (Rendimentos)', tipo: 'entrada', color: 'var(--accent2)'},
  investimento:          { label: 'Investimento',                    tipo: 'saida',   color: 'var(--accent)' },
  despesasOperacionais:  { label: 'Despesas Operacionais',            tipo: 'saida',   color: 'var(--red)'    },
  ctv:                   { label: 'Custo Totalmente Variável (CTV)',  tipo: 'saida',   color: 'var(--yellow)' },
  despesasFinanceiras:   { label: 'Despesas Financeiras',             tipo: 'saida',   color: 'var(--red)'    },
};

function defaultData() {
  // Usado só como referência/fallback caso a linha em "academias" não exista
  // ainda (o normal é o trigger do banco já ter criado tudo no primeiro login).
  return {
    meta: {
      empresa: 'Minha Academia',
      tatame: { comprimento: 4.5, largura: 4.5 },
      concentracaoPico: 0.1,
      generatedMonths: [],
    },
    categoryGroups: {
      receita: ['MATRICULA KIDS','MATRICULA ADULTO','MENSALIDADE KIDS','MENSALIDADE ADULTO','KIMONO','PATCHES','MASCOTE','AULA PARTICULAR'],
      receitaFinanceira: ['RENDIMENTO DE APLICAÇÃO FINANCEIRA'],
      investimento: ['TREINAMENTO','EQUIPAMENTOS - COMPUTADORES','EQUIPAMENTOS - PERIFÉRICOS','AMBIENTE - MOBILIÁRIO','SOFTWARE - GESTÃO','MARKETING - COMUNICAÇÃO','MARKETING - VENDAS/FOLDERS/MÍDIA','MARKETING - GESTÃO MÍDIA SOCIAL','TATAME','EVENTO','APLICAÇÃO FINANCEIRA','PATCHES','KIMONOS','PLACA','ADESIVOS'],
      despesasOperacionais: ['PRO LABORE','COLABORADOR 1','COLABORADOR 2','COLABORADOR 3','ALUGUEL','CONDOMÍNIO','IPTU','SEGURO INCÊNDIO','TAXA BOLETO ALUGUEL','ESTACIONAMENTO','BENS DURÁVEIS DE PEQUENO VALOR','MATERIAL DE CONSUMO','MATERIAL ESCRITÓRIO - CONSUMÍVEIS','SERVIÇOS E MATERIAL DE LIMPEZA','MANUTENÇÃO - SERVIÇOS','MANUTENÇÃO - MATERIAIS','CONTABILIDADE','TFE','INSS','DARF','FGTS'],
      ctv: ['ISS - SOBRE FATURAMENTO','IRPJ','DAS','COMISSÃO'],
      despesasFinanceiras: ['TARIFA MOV CONTA','TARIFA PIX','TARIFA BOLETO','JUROS - CHEQUE ESPECIAL','ANUIDADE CARTÃO DE CRÉDITO','IOF - CONTA','IOF - CARTÃO','EMPRÉSTIMOS'],
    },
    turmas: [],
    students: [],
    transactions: [],
    cobrancaTemplates: [
      { id: 'c1', nome: 'Lembrete', diasRelativoVencimento: -3, assunto: 'Lembrete: mensalidade {mes} vence em breve — {academia}',
        mensagem: 'Oi {nome}! Passando para lembrar que sua mensalidade de {valor} vence em {vencimento}. Qualquer dúvida, é só chamar. Bons treinos! 🥋' },
      { id: 'c2', nome: 'Vencimento', diasRelativoVencimento: 0, assunto: 'Sua mensalidade vence hoje — {academia}',
        mensagem: 'Oi {nome}, tudo bem? Sua mensalidade de {valor} vence hoje ({vencimento}). Se já pagou, desconsidere esta mensagem. Obrigado!' },
      { id: 'c3', nome: 'Atraso', diasRelativoVencimento: 5, assunto: 'Mensalidade em atraso — {academia}',
        mensagem: 'Oi {nome}! Notamos que sua mensalidade de {valor}, vencida em {vencimento}, ainda está em aberto ({diasAtraso} dias). Pode regularizar quando puder? Qualquer problema me avisa.' },
      { id: 'c4', nome: 'Atraso Grave', diasRelativoVencimento: 15, assunto: 'Importante: mensalidade em atraso há {diasAtraso} dias — {academia}',
        mensagem: 'Oi {nome}, sua mensalidade de {valor} está em aberto há {diasAtraso} dias (venceu em {vencimento}). Precisamos regularizar a situação — vamos conversar?' },
    ],
  };
}

let data = null; // populado por loadDataFromApi() depois do login

function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- Carregamento inicial (pós-login) ---------------- */
async function loadDataFromApi() {
  try {
    data = await api.get('/api/bootstrap');
  } catch (e) {
    showToast('Erro ao carregar dados da academia: ' + e.message, 'error');
    data = defaultData();
  }
}

/* Salva no banco tudo que hoje vive na configuração da academia (não entidades) */
async function persistAcademiaSettings() {
  try {
    await api.put('/api/academia', { meta: data.meta, categoryGroups: data.categoryGroups, cobrancaTemplates: data.cobrancaTemplates });
  } catch (e) {
    showToast('Erro ao salvar configurações: ' + e.message, 'error');
  }
}

/* ---------------- Students CRUD ---------------- */
async function addStudent(student) {
  try {
    const saved = await api.post('/api/students', student);
    data.students.push(saved);
    return saved;
  } catch (e) {
    showToast('Erro ao salvar aluno: ' + e.message, 'error');
    throw e;
  }
}
async function updateStudent(id, patch) {
  const s = data.students.find(s => s.id === id);
  if (!s) return;
  Object.assign(s, patch);
  try {
    await api.put(`/api/students/${id}`, s);
  } catch (e) {
    showToast('Erro ao atualizar aluno: ' + e.message, 'error');
  }
}
async function deleteStudent(id) {
  data.students = data.students.filter(s => s.id !== id);
  try {
    await api.del(`/api/students/${id}`);
  } catch (e) {
    showToast('Erro ao excluir aluno: ' + e.message, 'error');
  }
}
function activeStudents() {
  return data.students.filter(s => s.status === 'Ativo');
}

/* ---------------- Turmas CRUD ---------------- */
async function addTurma(turma) {
  if (!turma.horarios) turma.horarios = [];
  try {
    const saved = await api.post('/api/turmas', turma);
    data.turmas.push(saved);
    return saved;
  } catch (e) {
    showToast('Erro ao salvar turma: ' + e.message, 'error');
    throw e;
  }
}
async function updateTurma(id, patch) {
  const t = data.turmas.find(t => t.id === id);
  if (!t) return;
  Object.assign(t, patch);
  try {
    await api.put(`/api/turmas/${id}`, t);
  } catch (e) {
    showToast('Erro ao atualizar turma: ' + e.message, 'error');
  }
}
async function deleteTurma(id) {
  data.turmas = data.turmas.filter(t => t.id !== id);
  try {
    await api.del(`/api/turmas/${id}`);
  } catch (e) {
    showToast('Erro ao excluir turma: ' + e.message, 'error');
  }
}
function studentsInTurma(turmaNome) {
  return data.students.filter(s => s.turma === turmaNome && s.status === 'Ativo');
}

/* ---------------- Categorias ---------------- */
async function addCategory(group, name) {
  name = (name || '').trim().toUpperCase();
  if (!name) return false;
  if (!data.categoryGroups[group]) data.categoryGroups[group] = [];
  if (data.categoryGroups[group].includes(name)) return false;
  data.categoryGroups[group].push(name);
  await persistAcademiaSettings();
  return true;
}
async function removeCategory(group, name) {
  if (!data.categoryGroups[group]) return false;
  const inUse = data.transactions.some(t => t.grupo === group && t.categoria === name);
  if (inUse) return false;
  data.categoryGroups[group] = data.categoryGroups[group].filter(c => c !== name);
  await persistAcademiaSettings();
  return true;
}

/* ---------------- Transactions CRUD ---------------- */
async function addTransaction(tx) {
  tx.tipo = GROUP_META[tx.grupo].tipo;
  try {
    const saved = await api.post('/api/transactions', tx);
    data.transactions.push(saved);
    return saved;
  } catch (e) {
    showToast('Erro ao salvar lançamento: ' + e.message, 'error');
    throw e;
  }
}
async function updateTransaction(id, patch) {
  const t = data.transactions.find(t => t.id === id);
  if (!t) return;
  Object.assign(t, patch);
  try {
    await api.put(`/api/transactions/${id}`, t);
  } catch (e) {
    showToast('Erro ao atualizar lançamento: ' + e.message, 'error');
  }
}
async function deleteTransaction(id) {
  data.transactions = data.transactions.filter(t => t.id !== id);
  try {
    await api.del(`/api/transactions/${id}`);
  } catch (e) {
    showToast('Erro ao excluir lançamento: ' + e.message, 'error');
  }
}
function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7); // YYYY-MM
}
function transactionsInMonth(yearMonth) {
  return data.transactions.filter(t => monthKey(t.data) === yearMonth);
}

/* ---------------- Geração automática de mensalidades/matrículas ---------------- */
function mensalidadeCategoriaFor(categoria) {
  if (categoria === 'Kids') return 'MENSALIDADE KIDS';
  if (categoria === 'Particular') return 'AULA PARTICULAR';
  return 'MENSALIDADE ADULTO';
}
function matriculaCategoriaFor(categoria) {
  return categoria === 'Kids' ? 'MATRICULA KIDS' : 'MATRICULA ADULTO';
}

async function ensureMensalidadesForMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const mesNome = MESES_PT[month - 1];
  const daysInMonth = new Date(year, month, 0).getDate();
  let created = 0;

  for (const s of activeStudents()) {
    // Mensalidade recorrente
    if (s.valorMensalidade > 0) {
      const categoria = mensalidadeCategoriaFor(s.categoria);
      const already = data.transactions.some(t => t.alunoId === s.id && t.categoria === categoria && monthKey(t.data) === yearMonth && t.origem === 'auto-mensalidade');
      if (!already) {
        const dia = Math.min(s.diaVencimento || 5, daysInMonth);
        const dataStr = `${yearMonth}-${String(dia).padStart(2,'0')}`;
        await addTransaction({
          data: dataStr, grupo: 'receita', categoria,
          descricao: `Mensalidade ${mesNome} — ${s.nome}`,
          valor: s.valorMensalidade, status: 'a_receber',
          alunoId: s.id, origem: 'auto-mensalidade',
        });
        created++;
      }
    }
    // Matrícula (evento único no mês cadastrado)
    if (s.valorMatricula > 0 && s.mesMatricula === mesNome) {
      const categoria = matriculaCategoriaFor(s.categoria);
      const already = data.transactions.some(t => t.alunoId === s.id && t.categoria === categoria && t.origem === 'auto-matricula');
      if (!already) {
        const dia = Math.min(s.diaMatricula || 1, daysInMonth);
        const dataStr = `${yearMonth}-${String(dia).padStart(2,'0')}`;
        await addTransaction({
          data: dataStr, grupo: 'receita', categoria,
          descricao: `Matrícula — ${s.nome}`,
          valor: s.valorMatricula, status: 'a_receber',
          alunoId: s.id, origem: 'auto-matricula',
        });
        created++;
      }
    }
  }

  if (!data.meta.generatedMonths.includes(yearMonth)) {
    data.meta.generatedMonths.push(yearMonth);
    await persistAcademiaSettings();
  }
  return created;
}

/* ---------------- Lançamentos recorrentes (despesas fixas repetidas todo mês) ---------------- */
function recurringTemplates() {
  // uma "série" recorrente é identificada por grupo+categoria+descrição; usa a
  // ocorrência mais recente marcada como recorrente como modelo pro próximo mês.
  const map = new Map();
  data.transactions.filter(t => t.recorrente).forEach(t => {
    const key = `${t.grupo}|${t.categoria}|${t.descricao || ''}`;
    const existing = map.get(key);
    if (!existing || t.data > existing.data) map.set(key, t);
  });
  return [...map.values()];
}

async function ensureRecorrentesForMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let created = 0;

  for (const tpl of recurringTemplates()) {
    const already = data.transactions.some(t =>
      t.grupo === tpl.grupo && t.categoria === tpl.categoria && (t.descricao||'') === (tpl.descricao||'') && monthKey(t.data) === yearMonth);
    if (already) continue;

    const dia = Math.min(Number(tpl.data.slice(-2)) || 5, daysInMonth);
    const dataStr = `${yearMonth}-${String(dia).padStart(2,'0')}`;
    await addTransaction({
      data: dataStr, grupo: tpl.grupo, categoria: tpl.categoria, descricao: tpl.descricao,
      valor: tpl.valor, status: tpl.tipo === 'entrada' ? 'a_receber' : 'a_pagar',
      origem: 'auto-recorrente', recorrente: true,
    });
    created++;
  }
  return created;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function autoGenerateOnLoad() {
  const ym = currentYearMonth();
  if (!data.meta.generatedMonths.includes(ym)) {
    await ensureMensalidadesForMonth(ym);
    await ensureRecorrentesForMonth(ym);
  }
}

/* ---------------- Agregações mensais (espelha estrutura da planilha) ---------------- */
function getMonthSummary(yearMonth) {
  const txs = transactionsInMonth(yearMonth);
  const byGroup = {};
  Object.keys(GROUP_META).forEach(g => byGroup[g] = { total: 0, categorias: {} });

  txs.forEach(t => {
    const g = byGroup[t.grupo] || (byGroup[t.grupo] = { total: 0, categorias: {} });
    g.total += t.valor;
    g.categorias[t.categoria] = (g.categorias[t.categoria] || 0) + t.valor;
  });

  const totalEntradas = byGroup.receita.total + byGroup.receitaFinanceira.total;
  const totalSaidas = byGroup.investimento.total + byGroup.despesasOperacionais.total + byGroup.ctv.total + byGroup.despesasFinanceiras.total;
  const resultado = totalEntradas - totalSaidas;
  const custoFinanceiroJuros = 0; // reservado para juros sobre capital de terceiros, se configurado
  const lucroLiquido = resultado - custoFinanceiroJuros;
  const investimento = byGroup.investimento.total;
  const rsi = investimento > 0 ? lucroLiquido / investimento : null;

  const aReceber = txs.filter(t => t.status === 'a_receber').reduce((s,t) => s + t.valor, 0);
  const aPagar = txs.filter(t => t.status === 'a_pagar').reduce((s,t) => s + t.valor, 0);

  return { yearMonth, byGroup, totalEntradas, totalSaidas, resultado, custoFinanceiroJuros, lucroLiquido, investimento, rsi, aReceber, aPagar, count: txs.length };
}

function lastNMonthKeys(n, endDate = new Date()) {
  const keys = [];
  const d = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`);
  }
  return keys;
}

function allMonthsWithData() {
  const set = new Set(data.transactions.map(t => monthKey(t.data)));
  return [...set].sort();
}

/* KPIs consolidados — janela móvel de 12 meses (já representa base anual) */
function computeKPIs() {
  const months = lastNMonthKeys(12);
  let lucroLiquidoTotal = 0, investimentoTotal = 0, entradasTotal = 0, saidasTotal = 0;
  months.forEach(mk => {
    const s = getMonthSummary(mk);
    lucroLiquidoTotal += s.lucroLiquido;
    investimentoTotal += s.investimento;
    entradasTotal += s.totalEntradas;
    saidasTotal += s.totalSaidas;
  });

  const rsiAnual = investimentoTotal > 0 ? (lucroLiquidoTotal / investimentoTotal) * 100 : null;

  const hoje = new Date().toISOString().slice(0,10);
  const aReceberTotal = data.transactions.filter(t => t.status === 'a_receber').reduce((s,t) => s + t.valor, 0);
  const aPagarTotal = data.transactions.filter(t => t.status === 'a_pagar').reduce((s,t) => s + t.valor, 0);
  const aReceberVencido = data.transactions.filter(t => t.status === 'a_receber' && t.data < hoje).reduce((s,t) => s + t.valor, 0);
  const aPagarVencido = data.transactions.filter(t => t.status === 'a_pagar' && t.data < hoje).reduce((s,t) => s + t.valor, 0);

  const mesAtual = getMonthSummary(currentYearMonth());

  const saldoCaixa = data.transactions
    .filter(t => t.status === 'recebido' || t.status === 'pago')
    .reduce((s,t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);

  return {
    rsiAnual, lucroLiquidoTotal, investimentoTotal, entradasTotal, saidasTotal,
    lucroLiquidoMesAtual: mesAtual.lucroLiquido,
    aReceberTotal, aPagarTotal, aReceberVencido, aPagarVencido,
    saldoCaixa,
    alunosAtivos: activeStudents().length,
  };
}

/* ---------------- Planejamento de ocupação do tatame ---------------- */
const DENSIDADE_NIVEIS = [
  { id: 'N1', descricao: 'Confortável — ideal para treino técnico', m2PorDupla: 10 },
  { id: 'N2', descricao: 'Operacional — padrão do dia a dia', m2PorDupla: 8 },
  { id: 'N3', descricao: 'Segurança — limite mínimo aceitável', m2PorDupla: 6 },
];

function computeTatameCapacity() {
  const { comprimento, largura } = data.meta.tatame;
  const area = comprimento * largura;
  const niveis = DENSIDADE_NIVEIS.map(n => {
    const duplas = area / n.m2PorDupla;
    return { ...n, duplas, alunosEquivalentes: duplas * 2 };
  });
  const individual = { id: 'Individual', descricao: '1 aluno sem par — referência mínima por pessoa', m2PorDupla: 4, duplas: null, alunosEquivalentes: area / 4 };
  const capacidadeSeguranca = niveis.find(n => n.id === 'N3').alunosEquivalentes;
  return { area, niveis: [...niveis, individual], capacidadeSeguranca };
}

function classifyFaixa(freqAtual, tatame) {
  const n1 = tatame.niveis.find(n => n.id === 'N1').alunosEquivalentes;
  const n2 = tatame.niveis.find(n => n.id === 'N2').alunosEquivalentes;
  const n3 = tatame.niveis.find(n => n.id === 'N3').alunosEquivalentes;
  if (freqAtual <= n1) return { id: 'N1', label: 'Confortável', cor: 'var(--green)' };
  if (freqAtual <= n2) return { id: 'N2', label: 'Operacional', cor: 'var(--accent)' };
  if (freqAtual <= n3) return { id: 'N3', label: 'Segurança', cor: 'var(--yellow)' };
  return { id: 'acima', label: 'Acima do Limite', cor: 'var(--red)' };
}

function computeOcupacaoTurmas() {
  const tatame = computeTatameCapacity();
  const { capacidadeSeguranca } = tatame;
  return data.turmas.map(t => {
    const crescimento = t.freqAnterior > 0 ? (t.freqAtual - t.freqAnterior) / t.freqAnterior : 0;
    const pctCapacidade = capacidadeSeguranca > 0 ? t.freqAtual / capacidadeSeguranca : 0;
    let nivel = 'ok', label = 'OK';
    if (pctCapacidade > 1) { nivel = 'critico'; label = 'CRÍTICO'; }
    else if (pctCapacidade >= 0.7) { nivel = 'atencao'; label = 'ATENÇÃO'; }
    const faixa = classifyFaixa(t.freqAtual, tatame);
    return { ...t, crescimento, pctCapacidade, nivel, label, faixa, alunosMatriculados: studentsInTurma(t.nome).length };
  });
}

function computePlanejamentoDiagnostico() {
  const ocupacao = computeOcupacaoTurmas();
  const { capacidadeSeguranca } = computeTatameCapacity();
  const somaFreqAtual = ocupacao.reduce((s,t) => s + t.freqAtual, 0);
  const somaFreqAnterior = ocupacao.reduce((s,t) => s + t.freqAnterior, 0);
  const crescimentoTotal = somaFreqAnterior > 0 ? (somaFreqAtual - somaFreqAnterior) / somaFreqAnterior : 0;
  const concentracaoPico = data.meta.concentracaoPico || 0.1;
  const estouroEm = concentracaoPico > 0 ? somaFreqAtual / concentracaoPico : Infinity;
  const alunosAtivos = activeStudents().length;
  const maxPct = Math.max(0, ...ocupacao.map(t => t.pctCapacidade));

  let alerta;
  if (maxPct > 1 || alunosAtivos >= estouroEm) {
    alerta = { nivel: 'critico', texto: 'AÇÃO IMEDIATA: crie o tatame B e separe as turmas por nível — a capacidade de segurança já foi ultrapassada.' };
  } else if (maxPct >= 0.7 || alunosAtivos >= estouroEm * 0.8) {
    alerta = { nivel: 'atencao', texto: 'PLANEJAR EXPANSÃO: você está se aproximando do limite. Comece a estruturar o tatame B nos próximos meses.' };
  } else {
    alerta = { nivel: 'ok', texto: 'SITUAÇÃO CONFORTÁVEL: a capacidade atual atende bem a demanda. Continue monitorando esta seção mensalmente.' };
  }

  const turmaMaisCheia = ocupacao.reduce((b, t) => t.pctCapacidade > b.pctCapacidade ? t : b, ocupacao[0] || { pctCapacidade: 0, freqAtual: 0, nome: '—' });
  const tatame = computeTatameCapacity();
  const faixaAtual = classifyFaixa(turmaMaisCheia.freqAtual || 0, tatame);

  return { ocupacao, capacidadeSeguranca, crescimentoTotal, concentracaoPico, estouroEm, alunosAtivos, alerta, turmaMaisCheia, faixaAtual, tatame };
}

/* ---------------- Inadimplência ---------------- */
function mensalidadeTransactionFor(studentId, yearMonth) {
  return data.transactions.find(t => t.alunoId === studentId && monthKey(t.data) === yearMonth &&
    (t.origem === 'auto-mensalidade' || t.categoria === 'AULA PARTICULAR' || t.categoria.startsWith('MENSALIDADE')));
}

function daysBetween(dateStr, refDate = new Date()) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  return Math.round((ref - due) / 86400000); // positivo = atrasado, negativo = ainda não venceu
}

async function getInadimplenciaList(yearMonth) {
  await ensureMensalidadesForMonth(yearMonth);
  return activeStudents().filter(s => s.valorMensalidade > 0).map(s => {
    const tx = mensalidadeTransactionFor(s.id, yearMonth);
    const pago = tx ? (tx.status === 'recebido') : false;
    const diasAtraso = tx ? daysBetween(tx.data) : 0;
    let situacao = 'pendente';
    if (pago) situacao = 'pago';
    else if (diasAtraso > 0) situacao = 'atrasado';
    return { student: s, tx, pago, diasAtraso, situacao };
  }).sort((a,b) => b.diasAtraso - a.diasAtraso);
}

/* ---------------- Régua de Cobrança ---------------- */
function pickCobrancaTemplate(diasAtraso) {
  const ordenados = [...data.cobrancaTemplates].sort((a,b) => a.diasRelativoVencimento - b.diasRelativoVencimento);
  let escolhido = ordenados[0];
  for (const t of ordenados) {
    if (diasAtraso >= t.diasRelativoVencimento) escolhido = t;
  }
  return escolhido;
}

function renderCobrancaTemplate(template, student, tx) {
  const vencimento = tx ? fmtDate(tx.data) : '—';
  const diasAtraso = tx ? Math.max(0, daysBetween(tx.data)) : 0;
  const vars = {
    nome: student.nome,
    valor: fmtFull(student.valorMensalidade),
    vencimento,
    diasAtraso: String(diasAtraso),
    academia: data.meta.empresa,
    mes: tx ? MESES_PT[Number(monthKey(tx.data).split('-')[1]) - 1] : '',
  };
  const replaceVars = (str) => str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return { assunto: replaceVars(template.assunto), mensagem: replaceVars(template.mensagem) };
}

async function addCobrancaTemplate(tpl) {
  tpl.id = uid('c');
  data.cobrancaTemplates.push(tpl);
  await persistAcademiaSettings();
  return tpl;
}
async function updateCobrancaTemplate(id, patch) {
  const t = data.cobrancaTemplates.find(t => t.id === id);
  if (t) Object.assign(t, patch);
  await persistAcademiaSettings();
}
async function deleteCobrancaTemplate(id) {
  data.cobrancaTemplates = data.cobrancaTemplates.filter(t => t.id !== id);
  await persistAcademiaSettings();
}

/* ---------------- Configurações da Academia ---------------- */
async function updateAcademiaNome(nome) {
  data.meta.empresa = nome;
  await persistAcademiaSettings();
}

async function changeAcademiaSenha(senhaAtual, novaSenha) {
  await api.put('/academia/senha', { senhaAtual, novaSenha });
}
