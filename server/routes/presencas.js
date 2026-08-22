/* Chamada — presença por aluno/data/turma. A turma é só informativa: não
   trava quem pode ser marcado presente numa chamada (aluno pode treinar
   fora da turma cadastrada dele — reposição, drop-in, troca de horário). */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { presencaToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM presencas WHERE academia_id = ? ORDER BY data DESC', [req.academiaId]);
  res.json(rows.map(presencaToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { alunoId, data, turma } = req.body || {};
  if (!alunoId || !data) return res.status(400).json({ error: 'Informe o aluno e a data.' });

  const [existing] = await pool.query(
    'SELECT * FROM presencas WHERE academia_id = ? AND aluno_id = ? AND data = ? AND turma <=> ?',
    [req.academiaId, alunoId, data, turma || null]
  );
  if (existing[0]) return res.json(presencaToJSON(existing[0]));

  const [result] = await pool.query(
    'INSERT INTO presencas (academia_id, aluno_id, data, turma) VALUES (?,?,?,?)',
    [req.academiaId, alunoId, data, turma || null]
  );
  const [rows] = await pool.query('SELECT * FROM presencas WHERE id = ?', [result.insertId]);
  res.json(presencaToJSON(rows[0]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM presencas WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
