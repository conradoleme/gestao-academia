const express = require('express');
const router = express.Router();
const pool = require('../db');
const { turmaToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');
const { readVersion, updateLocked, replyLockResult } = require('../locks');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM turmas WHERE academia_id = ?', [req.academiaId]);
  res.json(rows.map(turmaToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const t = req.body;
  if (!t.nome) return res.status(400).json({ error: 'Nome da turma é obrigatório.' });
  const [result] = await pool.query(
    `INSERT INTO turmas (academia_id, nome, horarios, freq_anterior, freq_atual) VALUES (?,?,?,?,?)`,
    [req.academiaId, t.nome, JSON.stringify(t.horarios || []), t.freqAnterior || 0, t.freqAtual || 0]
  );
  const [rows] = await pool.query('SELECT * FROM turmas WHERE id = ?', [result.insertId]);
  res.json(turmaToJSON(rows[0]));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const t = req.body;
  const v = readVersion(req, res); if (v === null) return;
  const where = 'id=? AND academia_id=?', ids = [req.params.id, req.academiaId];
  const ok = await updateLocked('turmas', 'nome=?, horarios=?, freq_anterior=?, freq_atual=?',
    [t.nome, JSON.stringify(t.horarios || []), t.freqAnterior || 0, t.freqAtual || 0], where, ids, v);
  await replyLockResult(res, ok, v, 'turmas', where, ids, 'Turma não encontrada.');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM turmas WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
