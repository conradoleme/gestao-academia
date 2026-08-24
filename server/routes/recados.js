/* Mural de recados — o instrutor posta um aviso global, pra uma turma, ou
   direto pra um aluno. Sem validade: fica visível até alguém apagar. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { recadoToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

const ALCANCES_VALIDOS = ['global', 'turma', 'aluno'];

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM recados WHERE academia_id = ? ORDER BY created_at DESC', [req.academiaId]);
  res.json(rows.map(recadoToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { alcance, turma, alunoId, titulo, mensagem } = req.body || {};
  if (!titulo || !mensagem) return res.status(400).json({ error: 'Informe o título e a mensagem.' });
  if (!ALCANCES_VALIDOS.includes(alcance)) return res.status(400).json({ error: 'Alcance inválido.' });
  if (alcance === 'turma' && !turma) return res.status(400).json({ error: 'Selecione a turma.' });
  if (alcance === 'aluno' && !alunoId) return res.status(400).json({ error: 'Selecione o aluno.' });

  if (alcance === 'aluno') {
    const [rows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [alunoId, req.academiaId]);
    if (!rows[0]) return res.status(400).json({ error: 'Aluno não encontrado.' });
  }

  const [result] = await pool.query(
    `INSERT INTO recados (academia_id, alcance, turma, aluno_id, titulo, mensagem) VALUES (?,?,?,?,?,?)`,
    [req.academiaId, alcance, alcance === 'turma' ? turma : null, alcance === 'aluno' ? alunoId : null, titulo, mensagem]
  );
  const [rows] = await pool.query('SELECT * FROM recados WHERE id = ?', [result.insertId]);
  res.json(recadoToJSON(rows[0]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM recados WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
