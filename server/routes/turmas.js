const express = require('express');
const router = express.Router();
const pool = require('../db');
const { turmaToJSON } = require('../mappers');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM turmas WHERE academia_id = ?', [req.academiaId]);
  res.json(rows.map(turmaToJSON));
});

router.post('/', async (req, res) => {
  const t = req.body;
  if (!t.nome) return res.status(400).json({ error: 'Nome da turma é obrigatório.' });
  const [result] = await pool.query(
    `INSERT INTO turmas (academia_id, nome, horarios, freq_anterior, freq_atual) VALUES (?,?,?,?,?)`,
    [req.academiaId, t.nome, JSON.stringify(t.horarios || []), t.freqAnterior || 0, t.freqAtual || 0]
  );
  const [rows] = await pool.query('SELECT * FROM turmas WHERE id = ?', [result.insertId]);
  res.json(turmaToJSON(rows[0]));
});

router.put('/:id', async (req, res) => {
  const t = req.body;
  await pool.query(
    `UPDATE turmas SET nome=?, horarios=?, freq_anterior=?, freq_atual=? WHERE id=? AND academia_id=?`,
    [t.nome, JSON.stringify(t.horarios || []), t.freqAnterior || 0, t.freqAtual || 0, req.params.id, req.academiaId]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM turmas WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
});

module.exports = router;
