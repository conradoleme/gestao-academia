/* Upsert compartilhado entre a rota de gestão (fichas-medicas.js, admin +
   operação, qualquer aluno) e a do portal (aluno.js, só a própria ficha) —
   mesma tabela, mesmos campos, só muda quem pode chamar.

   Trava otimista: version 0 = ficha ainda não existe (cria); version >= 1 =
   só atualiza se ninguém gravou no meio. Retorna null em caso de conflito. */
const pool = require('./db');
const { fichaMedicaToJSON } = require('./mappers');

const CAMPOS = [
  ['contato_emergencia_nome', 'contatoEmergenciaNome'], ['contato_emergencia_parentesco', 'contatoEmergenciaParentesco'],
  ['contato_emergencia_telefone', 'contatoEmergenciaTelefone'], ['tipo_sanguineo', 'tipoSanguineo'],
  ['alergias', 'alergias'], ['condicoes_medicas', 'condicoesMedicas'], ['medicamentos', 'medicamentos'],
  ['lesoes_previas', 'lesoesPrevias'], ['restricao_pratica', 'restricaoPratica'],
  ['hospital_preferencia', 'hospitalPreferencia'], ['plano_saude', 'planoSaude'], ['numero_carteirinha', 'numeroCarteirinha'],
  ['responsavel_legal_nome', 'responsavelLegalNome'], ['responsavel_legal_telefone', 'responsavelLegalTelefone'],
];

async function upsertFichaMedica(academiaId, alunoId, f, version) {
  const valores = CAMPOS.map(([, k]) => f[k] || null);
  if (version === 0) {
    try {
      await pool.query(
        `INSERT INTO fichas_medicas (academia_id, aluno_id, ${CAMPOS.map(c => c[0]).join(', ')}) VALUES (?,?,${CAMPOS.map(() => '?').join(',')})`,
        [academiaId, alunoId, ...valores]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return null;
      throw e;
    }
  } else {
    const [r] = await pool.query(
      `UPDATE fichas_medicas SET ${CAMPOS.map(c => c[0] + '=?').join(', ')}, version = version + 1 WHERE aluno_id = ? AND academia_id = ? AND version = ?`,
      [...valores, alunoId, academiaId, version]
    );
    if (r.affectedRows !== 1) return null;
  }
  const [rows] = await pool.query('SELECT * FROM fichas_medicas WHERE aluno_id = ? AND academia_id = ?', [alunoId, academiaId]);
  return fichaMedicaToJSON(rows[0]);
}

function fichaMedicaVazia(alunoId) {
  return {
    alunoId: String(alunoId), contatoEmergenciaNome: '', contatoEmergenciaParentesco: '', contatoEmergenciaTelefone: '',
    tipoSanguineo: '', alergias: '', condicoesMedicas: '', medicamentos: '',
    lesoesPrevias: '', restricaoPratica: '', hospitalPreferencia: '', planoSaude: '', numeroCarteirinha: '',
    responsavelLegalNome: '', responsavelLegalTelefone: '', updatedAt: null, version: 0,
  };
}

module.exports = { upsertFichaMedica, fichaMedicaVazia };
