/* Histórico de graduações — registrar uma promoção sempre atualiza a faixa
   atual do aluno (students.faixa/grau) junto. O sistema nunca promove
   sozinho: isso só acontece quando o instrutor confirma pela tela. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { graduacaoToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');
const { readVersion, updateLocked, sendConflict } = require('../locks');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE academia_id = ? ORDER BY data DESC', [req.academiaId]);
  res.json(rows.map(graduacaoToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { alunoId, data, faixaAnterior, faixaNova, grau, observacoes } = req.body || {};
  if (!alunoId || !data || !faixaNova) return res.status(400).json({ error: 'Informe o aluno, a data e a nova faixa.' });
  // Trava pela versão do ALUNO: duas telas não graduam o mesmo aluno duas vezes.
  const v = readVersion(req, res, 'alunoVersion'); if (v === null) return;

  const where = 'id=? AND academia_id=?', ids = [alunoId, req.academiaId];
  const ok = await updateLocked('students', 'faixa=?, grau=?, aulas_anteriores=0, graduacao_adiada_ate=NULL', [faixaNova, grau || 0], where, ids, v);
  if (!ok) {
    const [s] = await pool.query('SELECT id FROM students WHERE id=? AND academia_id=?', ids);
    return s[0] ? sendConflict(res) : res.status(404).json({ error: 'Aluno não encontrado.' });
  }
  const [result] = await pool.query(
    `INSERT INTO graduacoes (academia_id, aluno_id, data, faixa_anterior, faixa_nova, grau, observacoes) VALUES (?,?,?,?,?,?,?)`,
    [req.academiaId, alunoId, data, faixaAnterior || null, faixaNova, grau || 0, observacoes || null]
  );
  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE id = ?', [result.insertId]);
  res.json({ ...graduacaoToJSON(rows[0]), alunoVersion: v + 1 });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  const grad = rows[0];
  if (!grad) return res.json({ ok: true });
  const v = readVersion(req, res, 'alunoVersion', 'query'); if (v === null) return;

  // Desfaz a graduação: volta o aluno pra faixa anterior registrada nesse evento.
  const ok = await updateLocked('students', 'faixa=?, grau=0', [grad.faixa_anterior], 'id=? AND academia_id=?', [grad.aluno_id, req.academiaId], v);
  if (!ok) return sendConflict(res);
  await pool.query('DELETE FROM graduacoes WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true, alunoVersion: v + 1 });
}));

module.exports = router;
