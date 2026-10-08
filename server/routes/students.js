const express = require('express');
const router = express.Router();
const pool = require('../db');
const { studentToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');
const { readVersion, updateLocked, replyLockResult } = require('../locks');

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
  const v = readVersion(req, res); if (v === null) return;
  const where = 'id=? AND academia_id=?', ids = [req.params.id, req.academiaId];
  const ok = await updateLocked('students',
    'nome=?, turma=?, categoria=?, status=?, valor_mensalidade=?, dia_vencimento=?, valor_matricula=?, mes_matricula=?, dia_matricula=?, email=?, telefone=?, observacoes=?, data_inicio=?, faixa=?, grau=?, aulas_anteriores=?',
    [s.nome, s.turma || null, s.categoria, s.status, s.valorMensalidade || 0, s.diaVencimento || null,
     s.valorMatricula || 0, s.mesMatricula || null, s.diaMatricula || null, s.email || null,
     s.telefone || null, s.observacoes || null, s.dataInicio || null, s.faixa || null, s.grau || 0, Math.max(0, parseInt(s.aulasAnteriores) || 0)],
    where, ids, v);
  await replyLockResult(res, ok, v, 'students', where, ids, 'Aluno não encontrado.');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM students WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

router.put('/:id/adiar-graduacao', asyncHandler(async (req, res) => {
  const dias = Math.min(365, Math.max(1, parseInt(req.body?.dias) || 30));
  const v = readVersion(req, res); if (v === null) return;
  const where = 'id=? AND academia_id=?', ids = [req.params.id, req.academiaId];
  const ok = await updateLocked('students', 'graduacao_adiada_ate = DATE_ADD(CURDATE(), INTERVAL ? DAY)', [dias], where, ids, v);
  if (!ok) return replyLockResult(res, false, v, 'students', where, ids, 'Aluno não encontrado.');
  const [rows] = await pool.query('SELECT graduacao_adiada_ate FROM students WHERE id=?', [req.params.id]);
  res.json({ ok: true, ate: rows[0].graduacao_adiada_ate, version: v + 1 });
}));

// Grau (ponta) não é graduação de faixa: só atualiza o grau, sem criar evento
// no histórico — um evento reiniciaria a contagem de aulas da faixa.
router.put('/:id/grau', asyncHandler(async (req, res) => {
  const grau = Math.min(10, Math.max(0, parseInt(req.body?.grau) || 0));
  const v = readVersion(req, res); if (v === null) return;
  const where = 'id=? AND academia_id=?', ids = [req.params.id, req.academiaId];
  const ok = await updateLocked('students', 'grau=?, graduacao_adiada_ate=NULL', [grau], where, ids, v);
  if (!ok) return replyLockResult(res, false, v, 'students', where, ids, 'Aluno não encontrado.');
  res.json({ ok: true, grau, version: v + 1 });
}));

module.exports = router;
