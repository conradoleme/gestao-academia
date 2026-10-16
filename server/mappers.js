/* Converte linhas do MySQL (snake_case) para o formato camelCase que o
   frontend já usa (e vice-versa é feito direto nas rotas, campo a campo).

   IDs sempre viram string: o frontend foi construído para IDs gerados no
   próprio navegador (ex: "tx_ab12cd") e faz muita comparação com "===" a
   partir de valores lidos de atributos HTML (sempre string). Os IDs
   numéricos do MySQL (auto-increment) precisam ser convertidos aqui, senão
   number !== string quebra essas comparações silenciosamente. */

function studentToJSON(r) {
  return {
    id: String(r.id), nome: r.nome, turma: r.turma || '', categoria: r.categoria, status: r.status,
    valorMensalidade: Number(r.valor_mensalidade) || 0, diaVencimento: r.dia_vencimento,
    valorMatricula: Number(r.valor_matricula) || 0, mesMatricula: r.mes_matricula,
    diaMatricula: r.dia_matricula, email: r.email || '', telefone: r.telefone || '',
    observacoes: r.observacoes || '',
    dataInicio: r.data_inicio || null, faixa: r.faixa || null, grau: Number(r.grau) || 0,
    aulasAnteriores: Number(r.aulas_anteriores) || 0,
    graduacaoAdiadaAte: r.graduacao_adiada_ate || null,
    version: Number(r.version) || 1,
  };
}

function presencaToJSON(r) {
  return {
    id: String(r.id), alunoId: String(r.aluno_id), data: r.data, turma: r.turma || '',
  };
}

function graduacaoToJSON(r) {
  return {
    id: String(r.id), alunoId: String(r.aluno_id), data: r.data,
    faixaAnterior: r.faixa_anterior || null, faixaNova: r.faixa_nova, grau: Number(r.grau) || 0,
    observacoes: r.observacoes || '',
  };
}

const { descriptografarTexto } = require('./crypto');

function fichaMedicaToJSON(r) {
  if (!r) return null;
  const d = descriptografarTexto; // valor antigo (sem criptografia) passa direto
  return {
    alunoId: String(r.aluno_id),
    contatoEmergenciaNome: d(r.contato_emergencia_nome) || '',
    contatoEmergenciaParentesco: d(r.contato_emergencia_parentesco) || '',
    contatoEmergenciaTelefone: d(r.contato_emergencia_telefone) || '',
    tipoSanguineo: d(r.tipo_sanguineo) || '',
    alergias: d(r.alergias) || '',
    condicoesMedicas: d(r.condicoes_medicas) || '',
    medicamentos: d(r.medicamentos) || '',
    lesoesPrevias: d(r.lesoes_previas) || '',
    restricaoPratica: d(r.restricao_pratica) || '',
    hospitalPreferencia: d(r.hospital_preferencia) || '',
    planoSaude: d(r.plano_saude) || '',
    numeroCarteirinha: d(r.numero_carteirinha) || '',
    responsavelLegalNome: d(r.responsavel_legal_nome) || '',
    responsavelLegalTelefone: d(r.responsavel_legal_telefone) || '',
    updatedAt: r.updated_at,
    version: Number(r.version) || 1,
  };
}

function recadoToJSON(r) {
  return {
    id: String(r.id), alcance: r.alcance, turma: r.turma || null,
    alunoId: r.aluno_id ? String(r.aluno_id) : null,
    titulo: r.titulo, mensagem: r.mensagem, createdAt: r.created_at,
  };
}

function turmaToJSON(r) {
  return {
    id: String(r.id), nome: r.nome, horarios: r.horarios || [],
    freqAnterior: Number(r.freq_anterior) || 0, freqAtual: Number(r.freq_atual) || 0,
    version: Number(r.version) || 1,
  };
}

function txToJSON(r) {
  return {
    id: String(r.id), data: r.data, grupo: r.grupo, categoria: r.categoria, descricao: r.descricao || '',
    valor: Number(r.valor) || 0, status: r.status, tipo: r.tipo,
    alunoId: r.aluno_id === null || r.aluno_id === undefined ? null : String(r.aluno_id),
    origem: r.origem || '', recorrente: !!r.recorrente,
    recorrenciaMeses: r.recorrencia_meses === null || r.recorrencia_meses === undefined ? null : Number(r.recorrencia_meses),
    version: Number(r.version) || 1,
  };
}

function usuarioToJSON(r) {
  return {
    id: String(r.id), nome: r.nome, email: r.email, role: r.role,
    alunoId: r.aluno_id === null || r.aluno_id === undefined ? null : String(r.aluno_id),
    createdAt: r.created_at,
    version: Number(r.version) || 1,
  };
}

/* Professor (operacao) não vê nada financeiro: o servidor nem envia — esconder
   só na tela não basta, o dado ficaria acessível pelo console/rede. */
function studentToJSONParaOperacao(r) {
  return { ...studentToJSON(r), valorMensalidade: 0, diaVencimento: null, valorMatricula: 0, mesMatricula: null, diaMatricula: null };
}

function academiaShapeParaOperacao(shape) {
  const { email, telefone, trialEndsAt, stripeAssinaturaAtiva, ...meta } = shape.meta;
  return { ...shape, meta, cobrancaTemplates: [] };
}

function academiaToShape(r) {
  return {
    meta: {
      empresa: r.nome,
      tatame: { comprimento: Number(r.tatame_comprimento), largura: Number(r.tatame_largura) },
      concentracaoPico: Number(r.concentracao_pico),
      generatedMonths: r.generated_months || [],
      logoUrl: r.logo_key ? `/logo/${r.id}` : null,
      watermarkAtivo: !!r.watermark_ativo,
      slug: r.slug || null,
      usaGrau: r.usa_grau === undefined || r.usa_grau === null ? true : !!r.usa_grau,
      email: r.email || null,
      telefone: r.telefone || null,
      modalidade: r.modalidade || 'bjj',
      trialEndsAt: r.trial_ends_at || null,
      stripeAssinaturaAtiva: !!r.stripe_subscription_id,
      isenta: !!r.isenta,
    },
    categoryGroups: r.category_groups || {},
    cobrancaTemplates: r.cobranca_templates || [],
    graduacaoRegras: r.graduacao_regras || {},
    versions: { meta: r.ver_meta || 1, regras: r.ver_regras || 1, categorias: r.ver_categorias || 1, cobranca: r.ver_cobranca || 1 },
  };
}

module.exports = { studentToJSONParaOperacao, academiaShapeParaOperacao, studentToJSON, turmaToJSON, txToJSON, academiaToShape, usuarioToJSON, presencaToJSON, graduacaoToJSON, recadoToJSON, fichaMedicaToJSON };
