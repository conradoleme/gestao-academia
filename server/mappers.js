/* Converte linhas do MySQL (snake_case) para o formato camelCase que o
   frontend já usa (e vice-versa é feito direto nas rotas, campo a campo). */

function studentToJSON(r) {
  return {
    id: r.id, nome: r.nome, turma: r.turma || '', categoria: r.categoria, status: r.status,
    valorMensalidade: Number(r.valor_mensalidade) || 0, diaVencimento: r.dia_vencimento,
    valorMatricula: Number(r.valor_matricula) || 0, mesMatricula: r.mes_matricula,
    diaMatricula: r.dia_matricula, email: r.email || '', telefone: r.telefone || '',
    observacoes: r.observacoes || '',
  };
}

function turmaToJSON(r) {
  return {
    id: r.id, nome: r.nome, horarios: r.horarios || [],
    freqAnterior: Number(r.freq_anterior) || 0, freqAtual: Number(r.freq_atual) || 0,
  };
}

function txToJSON(r) {
  return {
    id: r.id, data: r.data, grupo: r.grupo, categoria: r.categoria, descricao: r.descricao || '',
    valor: Number(r.valor) || 0, status: r.status, tipo: r.tipo, alunoId: r.aluno_id, origem: r.origem || '',
  };
}

function academiaToShape(r) {
  return {
    meta: {
      empresa: r.nome,
      tatame: { comprimento: Number(r.tatame_comprimento), largura: Number(r.tatame_largura) },
      concentracaoPico: Number(r.concentracao_pico),
      generatedMonths: r.generated_months || [],
    },
    categoryGroups: r.category_groups || {},
    cobrancaTemplates: r.cobranca_templates || [],
  };
}

module.exports = { studentToJSON, turmaToJSON, txToJSON, academiaToShape };
