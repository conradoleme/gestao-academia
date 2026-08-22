/* Valores padrão usados ao criar uma academia nova — compartilhado entre o
   script de linha de comando (scripts/create-academia.js) e a rota
   administrativa de provisionamento (index.js). */

const DEFAULT_CATEGORY_GROUPS = {
  receita: ['MATRICULA KIDS','MATRICULA ADULTO','MENSALIDADE KIDS','MENSALIDADE ADULTO','KIMONO','PATCHES','MASCOTE','AULA PARTICULAR','RASH GUARD','LAVAGEM KIMONO','GRADUAÇÃO - EXAME DE FAIXA','AULA EXPERIMENTAL','INSCRIÇÃO EM EVENTO/SEMINÁRIO','FAIXA'],
  receitaFinanceira: ['RENDIMENTO DE APLICAÇÃO FINANCEIRA'],
  investimento: ['TREINAMENTO','EQUIPAMENTOS - COMPUTADORES','EQUIPAMENTOS - PERIFÉRICOS','AMBIENTE - MOBILIÁRIO','SOFTWARE - GESTÃO','MARKETING - COMUNICAÇÃO','MARKETING - VENDAS/FOLDERS/MÍDIA','MARKETING - GESTÃO MÍDIA SOCIAL','TATAME','EVENTO','APLICAÇÃO FINANCEIRA','PATCHES','KIMONOS','PLACA','ADESIVOS','AR CONDICIONADO/VENTILAÇÃO','REFORMA - OBRAS'],
  despesasOperacionais: ['PRO LABORE','SALÁRIOS','COLABORADOR 1','COLABORADOR 2','COLABORADOR 3','ALUGUEL','ÁGUA','LUZ','INTERNET','TELEFONE','CONDOMÍNIO','IPTU','SEGURO INCÊNDIO','TAXA BOLETO ALUGUEL','ESTACIONAMENTO','VALE TRANSPORTE','VALE ALIMENTAÇÃO','UNIFORME - FUNCIONÁRIOS','PRIMEIROS SOCORROS - MATERIAIS','BENS DURÁVEIS DE PEQUENO VALOR','MATERIAL DE CONSUMO','MATERIAL ESCRITÓRIO - CONSUMÍVEIS','SERVIÇOS E MATERIAL DE LIMPEZA','MANUTENÇÃO - SERVIÇOS','MANUTENÇÃO - MATERIAIS','CONTABILIDADE','TFE','INSS','DARF','FGTS'],
  ctv: ['ISS - SOBRE FATURAMENTO','IRPJ','DAS','COMISSÃO'],
  despesasFinanceiras: ['TARIFA MOV CONTA','TARIFA PIX','TARIFA BOLETO','JUROS - CHEQUE ESPECIAL','ANUIDADE CARTÃO DE CRÉDITO','IOF - CONTA','IOF - CARTÃO','EMPRÉSTIMOS'],
};

const DEFAULT_COBRANCA_TEMPLATES = [
  { id: 'c1', nome: 'Lembrete', diasRelativoVencimento: -3, assunto: 'Lembrete: mensalidade {mes} vence em breve — {academia}',
    mensagem: 'Oi {nome}! Passando para lembrar que sua mensalidade de {valor} vence em {vencimento}. Qualquer dúvida, é só chamar. Bons treinos! 🥋' },
  { id: 'c2', nome: 'Vencimento', diasRelativoVencimento: 0, assunto: 'Sua mensalidade vence hoje — {academia}',
    mensagem: 'Oi {nome}, tudo bem? Sua mensalidade de {valor} vence hoje ({vencimento}). Se já pagou, desconsidere esta mensagem. Obrigado!' },
  { id: 'c3', nome: 'Atraso', diasRelativoVencimento: 5, assunto: 'Mensalidade em atraso — {academia}',
    mensagem: 'Oi {nome}! Notamos que sua mensalidade de {valor}, vencida em {vencimento}, ainda está em aberto ({diasAtraso} dias). Pode regularizar quando puder? Qualquer problema me avisa.' },
  { id: 'c4', nome: 'Atraso Grave', diasRelativoVencimento: 15, assunto: 'Importante: mensalidade em atraso há {diasAtraso} dias — {academia}',
    mensagem: 'Oi {nome}, sua mensalidade de {valor} está em aberto há {diasAtraso} dias (venceu em {vencimento}). Precisamos regularizar a situação — vamos conversar?' },
];

const DEFAULT_TURMAS = [
  { nome: 'T730',  horarios: [{dia:'Segunda',hora:'07:30'},{dia:'Quarta',hora:'07:30'},{dia:'Sexta',hora:'07:30'}], freqAnterior: 2, freqAtual: 2 },
  { nome: 'T830',  horarios: [{dia:'Segunda',hora:'08:30'},{dia:'Quarta',hora:'08:30'},{dia:'Sexta',hora:'08:30'}], freqAnterior: 1, freqAtual: 1 },
  { nome: 'T930',  horarios: [{dia:'Terça',hora:'09:30'},{dia:'Quinta',hora:'09:30'}], freqAnterior: 2, freqAtual: 2 },
  { nome: 'T1600', horarios: [{dia:'Terça',hora:'16:00'},{dia:'Quinta',hora:'16:00'}], freqAnterior: 3, freqAtual: 3 },
  { nome: 'T1615', horarios: [{dia:'Segunda',hora:'16:15'},{dia:'Quarta',hora:'16:15'}], freqAnterior: 3, freqAtual: 3 },
  { nome: 'T2000', horarios: [{dia:'Segunda',hora:'20:00'},{dia:'Quarta',hora:'20:00'}], freqAnterior: 3, freqAtual: 3 },
];

/* Despesas mais comuns de uma academia de jiu-jitsu — pré-lançadas no mês
   atual (valor 0, status "a pagar") para toda academia nova, já editável
   direto na tela de Fluxo de Caixa, sem precisar cadastrar categoria por
   categoria do zero. */
const DEFAULT_DESPESAS = [
  { categoria: 'ALUGUEL', dia: 5 },
  { categoria: 'ÁGUA', dia: 10 },
  { categoria: 'LUZ', dia: 10 },
  { categoria: 'INTERNET', dia: 10 },
  { categoria: 'TELEFONE', dia: 10 },
  { categoria: 'PRO LABORE', dia: 5 },
  { categoria: 'SALÁRIOS', dia: 5 },
  { categoria: 'CONTABILIDADE', dia: 10 },
];

function buildDefaultTransactions() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  return DEFAULT_DESPESAS.map(({ categoria, dia }) => ({
    data: `${ano}-${mes}-${String(dia).padStart(2, '0')}`,
    grupo: 'despesasOperacionais',
    categoria,
    descricao: null,
    valor: 0,
    status: 'a_pagar',
    tipo: 'saida',
    origem: 'seed_padrao',
    recorrente: true,
  }));
}

/* Faixas + critério padrão pra graduar pra próxima, por categoria — cada
   academia pode reordenar, adicionar/remover faixas e editar os números
   livremente em Configurações. minMeses/minAulas/minFrequenciaSemanal são
   contados a partir da última graduação (ou de data_inicio, se o aluno
   nunca graduou). avaliacaoManual só lembra que o critério numérico é uma
   recomendação — quem graduar de fato é sempre o instrutor. */
const DEFAULT_GRADUACAO_REGRAS = {
  Adulto: [
    { nome: 'Branca', cor: '#f5f5f4', regra: { minMeses: 12, minAulas: 80, minFrequenciaSemanal: 2, avaliacaoManual: true } },
    { nome: 'Azul', cor: '#2563eb', regra: { minMeses: 24, minAulas: 150, minFrequenciaSemanal: 2, avaliacaoManual: true } },
    { nome: 'Roxa', cor: '#7c3aed', regra: { minMeses: 18, minAulas: 120, minFrequenciaSemanal: 2, avaliacaoManual: true } },
    { nome: 'Marrom', cor: '#78350f', regra: { minMeses: 12, minAulas: 100, minFrequenciaSemanal: 2, avaliacaoManual: true } },
    { nome: 'Preta', cor: '#1c1917', regra: null },
  ],
  Kids: [
    { nome: 'Branca', cor: '#f5f5f4', regra: { minMeses: 6, minAulas: 40, minFrequenciaSemanal: 1, avaliacaoManual: true } },
    { nome: 'Cinza', cor: '#9ca3af', regra: { minMeses: 6, minAulas: 40, minFrequenciaSemanal: 1, avaliacaoManual: true } },
    { nome: 'Amarela', cor: '#eab308', regra: { minMeses: 6, minAulas: 40, minFrequenciaSemanal: 1, avaliacaoManual: true } },
    { nome: 'Laranja', cor: '#f97316', regra: { minMeses: 6, minAulas: 40, minFrequenciaSemanal: 1, avaliacaoManual: true } },
    { nome: 'Verde', cor: '#16a34a', regra: null },
  ],
};

module.exports = { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS, buildDefaultTransactions, DEFAULT_GRADUACAO_REGRAS };
