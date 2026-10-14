/* Impede referenciar aluno de OUTRA academia em gravações (presença,
   lançamento): sem isso, um id vindo do cliente criava vínculo entre tenants. */
const pool = require('./db');

async function alunoDaAcademia(academiaId, alunoId) {
  if (!alunoId) return false;
  const [rows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [alunoId, academiaId]);
  return !!rows[0];
}

module.exports = { alunoDaAcademia };
