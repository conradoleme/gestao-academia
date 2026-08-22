const express = require('express');
const router = express.Router();
const pool = require('../db');
const { studentToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM students WHERE academia_id = ?', [req.academiaId]);
  res.json(rows.map(studentToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const s = req.body;
  if (!s.nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
  const [result] = await pool.query(
    `INSERT INTO students (academia_id, nome, turma, categoria, status, valor_mensalidade, dia_vencimento, valor_matricula, mes_matricula, dia_matricula, email, telefone, observacoes, data_inicio, faixa, grau)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.academiaId, s.nome, s.turma || null, s.categoria || 'Adulto', s.status || 'Ativo',
     s.valorMensalidade || 0, s.diaVencimento || null, s.valorMatricula || 0, s.mesMatricula || null,
     s.diaMatricula || null, s.email || null, s.telefone || null, s.observacoes || null,
     s.dataInicio || null, s.faixa || null, s.grau || 0]
  );
  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
  res.json(studentToJSON(rows[0]));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const s = req.body;
  await pool.query(
    `UPDATE students SET nome=?, turma=?, categoria=?, status=?, valor_mensalidade=?, dia_vencimento=?, valor_matricula=?, mes_matricula=?, dia_matricula=?, email=?, telefone=?, observacoes=?, data_inicio=?, faixa=?, grau=?
     WHERE id=? AND academia_id=?`,
    [s.nome, s.turma || null, s.categoria, s.status, s.valorMensalidade || 0, s.diaVencimento || null,
     s.valorMatricula || 0, s.mesMatricula || null, s.diaMatricula || null, s.email || null,
     s.telefone || null, s.observacoes || null, s.dataInicio || null, s.faixa || null, s.grau || 0,
     req.params.id, req.academiaId]
  );
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM students WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
