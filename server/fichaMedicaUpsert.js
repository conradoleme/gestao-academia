/* Upsert compartilhado entre a rota de gestão (fichas-medicas.js, admin +
   operação, qualquer aluno) e a do portal (aluno.js, só a própria ficha) —
   mesma tabela, mesmos campos, só muda quem pode chamar. */
const pool = require('./db');
const { fichaMedicaToJSON } = require('./mappers');

async function upsertFichaMedica(academiaId, alunoId, f) {
  await pool.query(
    `INSERT INTO fichas_medicas (academia_id, aluno_id, contato_emergencia_nome, contato_emergencia_parentesco, contato_emergencia_telefone, tipo_sanguineo, alergias, condicoes_medicas, medicamentos, lesoes_previas, restricao_pratica, hospital_preferencia, plano_saude, numero_carteirinha, responsavel_legal_nome, responsavel_legal_telefone)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       contato_emergencia_nome=VALUES(contato_emergencia_nome), contato_emergencia_parentesco=VALUES(contato_emergencia_parentesco), contato_emergencia_telefone=VALUES(contato_emergencia_telefone),
       tipo_sanguineo=VALUES(tipo_sanguineo), alergias=VALUES(alergias), condicoes_medicas=VALUES(condicoes_medicas), medicamentos=VALUES(medicamentos),
       lesoes_previas=VALUES(lesoes_previas), restricao_pratica=VALUES(restricao_pratica),
       hospital_preferencia=VALUES(hospital_preferencia), plano_saude=VALUES(plano_saude), numero_carteirinha=VALUES(numero_carteirinha),
       responsavel_legal_nome=VALUES(responsavel_legal_nome), responsavel_legal_telefone=VALUES(responsavel_legal_telefone)`,
    [academiaId, alunoId,
     f.contatoEmergenciaNome || null, f.contatoEmergenciaParentesco || null, f.contatoEmergenciaTelefone || null,
     f.tipoSanguineo || null, f.alergias || null, f.condicoesMedicas || null, f.medicamentos || null,
     f.lesoesPrevias || null, f.restricaoPratica || null,
     f.hospitalPreferencia || null, f.planoSaude || null, f.numeroCarteirinha || null,
     f.responsavelLegalNome || null, f.responsavelLegalTelefone || null]
  );
  const [rows] = await pool.query('SELECT * FROM fichas_medicas WHERE aluno_id = ? AND academia_id = ?', [alunoId, academiaId]);
  return fichaMedicaToJSON(rows[0]);
}

function fichaMedicaVazia(alunoId) {
  return {
    alunoId: String(alunoId), contatoEmergenciaNome: '', contatoEmergenciaParentesco: '', contatoEmergenciaTelefone: '',
    tipoSanguineo: '', alergias: '', condicoesMedicas: '', medicamentos: '',
    lesoesPrevias: '', restricaoPratica: '', hospitalPreferencia: '', planoSaude: '', numeroCarteirinha: '',
    responsavelLegalNome: '', responsavelLegalTelefone: '', updatedAt: null,
  };
}

module.exports = { upsertFichaMedica, fichaMedicaVazia };
