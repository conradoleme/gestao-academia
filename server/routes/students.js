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
    `INSERT INTO students (academia_id, nome, turma, categoria, status, valor_mensalidade, dia_vencimento, valor_matricula, mes_matricula, dia_matricula, email, telefone, observacoes, data_inicio, faixa, grau, aulas_anteriores)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.academiaId, s.nome, s.turma || null, s.categoria || 'Adulto', s.status || 'Ativo',
     s.valorMensalidade || 0, s.diaVencimento || null, s.valorMatricula || 0, s.mesMatricula || null,
     s.diaMatricula || null, s.email || null, s.telefone || null, s.observacoes || null,
     s.dataInicio || null, s.faixa || null, s.grau || 0, Math.max(0, parseInt(s.aulasAnteriores) || 0)]
  );
  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
  res.json(studentToJSON(rows[0]));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const s = req.body;
  await pool.query(
    `UPDATE students SET nome=?, turma=?, categoria=?, status=?, valor_mensalidade=?, dia_vencimento=?, valor_matricula=?, mes_matricula=?, dia_matricula=?, email=?, telefone=?, observacoes=?, data_inicio=?, faixa=?, grau=?, aulas_anteriores=?
     WHERE id=? AND academia_id=?`,
    [s.nome, s.turma || null, s.categoria, s.status, s.valorMensalidade || 0, s.diaVencimento || null,
     s.valorMatricula || 0, s.mesMatricula || null, s.diaMatricula || null, s.email || null,
     s.telefone || null, s.observacoes || null, s.dataInicio || null, s.faixa || null, s.grau || 0, Math.max(0, parseInt(s.aulasAnteriores) || 0),
     req.params.id, req.academiaId]
  );
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM students WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

router.put('/:id/adiar-graduacao', asyncHandler(async (req, res) => {
  const dias = Math.min(365, Math.max(1, parseInt(req.body?.dias) || 30));
  const [r] = await pool.query(
    'UPDATE students SET graduacao_adiada_ate = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE id=? AND academia_id=?',
    [dias, req.params.id, req.academiaId]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Aluno não encontrado.' });
  const [rows] = await pool.query('SELECT graduacao_adiada_ate FROM students WHERE id=?', [req.params.id]);
  res.json({ ok: true, ate: rows[0].graduacao_adiada_ate });
}));

// Grau (ponta) não é graduação de faixa: só atualiza o grau, sem criar evento
// no histórico — um evento reiniciaria a contagem de aulas da faixa.
router.put('/:id/grau', asyncHandler(async (req, res) => {
  const grau = Math.min(10, Math.max(0, parseInt(req.body?.grau) || 0));
  const [r] = await pool.query('UPDATE students SET grau=?, graduacao_adiada_ate=NULL WHERE id=? AND academia_id=?', [grau, req.params.id, req.academiaId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Aluno não encontrado.' });
  res.json({ ok: true, grau });
}));

module.exports = router;
