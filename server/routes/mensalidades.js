/* Fatia estreita de "transactions" que a operação pode ver/mexer: só
   lançamentos vinculados a um aluno (mensalidade/matrícula) — nunca
   despesas, salários, aluguel etc. Existe pra alimentar a tela de
   Cobrança sem abrir o ledger financeiro inteiro pra esse papel. */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { txToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

const STATUS_VALIDOS = ['a_receber', 'recebido'];

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM transactions WHERE academia_id = ? AND aluno_id IS NOT NULL',
    [req.academiaId]
  );
  res.json(rows.map(txToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const t = req.body || {};
  if (!t.alunoId) return res.status(400).json({ error: 'Informe o aluno.' });
  if (!t.data || !t.categoria || !t.status) return res.status(400).json({ error: 'Dados incompletos para o lançamento.' });
  if (!STATUS_VALIDOS.includes(t.status)) return res.status(400).json({ error: 'Status inválido.' });

  // grupo/tipo fixos em receita/entrada — essa rota nunca cria despesa.
  const [result] = await pool.query(
    `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, aluno_id, origem, recorrente, recorrencia_meses)
     VALUES (?,?,'receita',?,?,?,?,'entrada',?,?,0,NULL)`,
    [req.academiaId, t.data, t.categoria, t.descricao || null, t.valor || 0, t.status, t.alunoId, t.origem || null]
  );
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
  res.json(txToJSON(rows[0]));
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: 'Status inválido.' });

  const [rows] = await pool.query(
    'SELECT id FROM transactions WHERE id = ? AND academia_id = ? AND aluno_id IS NOT NULL',
    [req.params.id, req.academiaId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Lançamento não encontrado.' });

  await pool.query('UPDATE transactions SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
