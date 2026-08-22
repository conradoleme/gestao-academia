/* Histórico de graduações — registrar uma promoção sempre atualiza a faixa
   atual do aluno (students.faixa/grau) junto. O sistema nunca promove
   sozinho: isso só acontece quando o instrutor confirma pela tela. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { graduacaoToJSON } = require('../mappers');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE academia_id = ? ORDER BY data DESC', [req.academiaId]);
  res.json(rows.map(graduacaoToJSON));
});

router.post('/', async (req, res) => {
  const { alunoId, data, faixaAnterior, faixaNova, grau, observacoes } = req.body || {};
  if (!alunoId || !data || !faixaNova) return res.status(400).json({ error: 'Informe o aluno, a data e a nova faixa.' });

  const [result] = await pool.query(
    `INSERT INTO graduacoes (academia_id, aluno_id, data, faixa_anterior, faixa_nova, grau, observacoes) VALUES (?,?,?,?,?,?,?)`,
    [req.academiaId, alunoId, data, faixaAnterior || null, faixaNova, grau || 0, observacoes || null]
  );
  await pool.query('UPDATE students SET faixa=?, grau=? WHERE id=? AND academia_id=?', [faixaNova, grau || 0, alunoId, req.academiaId]);

  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE id = ?', [result.insertId]);
  res.json(graduacaoToJSON(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM graduacoes WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  const grad = rows[0];
  if (!grad) return res.json({ ok: true });

  await pool.query('DELETE FROM graduacoes WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  // Desfaz a graduação: volta o aluno pra faixa anterior registrada nesse evento.
  await pool.query('UPDATE students SET faixa=?, grau=0 WHERE id=? AND academia_id=?', [grad.faixa_anterior, grad.aluno_id, req.academiaId]);
  res.json({ ok: true });
});

module.exports = router;
