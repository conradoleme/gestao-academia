const express = require('express');
const router = express.Router();
const pool = require('../db');
const { txToJSON } = require('../mappers');
const { requireRole } = require('../auth');
const asyncHandler = require('../asyncHandler');
const { readVersion, updateLocked, replyLockResult } = require('../locks');

/* Ledger completo (despesas, salários, aluguel etc.) — só o dono vê. A
   operação lida só com mensalidades de aluno, pela rota /api/mensalidades. */
router.use(requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM transactions WHERE academia_id = ?', [req.academiaId]);
  res.json(rows.map(txToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const t = req.body;
  if (!t.data || !t.grupo || !t.categoria || !t.status || !t.tipo) {
    return res.status(400).json({ error: 'Dados incompletos para o lançamento.' });
  }
  // Despesa recorrente gerada automaticamente: uma por série (grupo+categoria+
  // descrição) por mês — várias telas abrindo juntas no começo do mês geravam
  // a mesma despesa N vezes. A trava fica no banco (dedup_key único).
  const dedupKey = t.origem === 'auto-recorrente'
    ? `${req.academiaId}|rec|${t.grupo}|${t.categoria}|${t.descricao || ''}|${String(t.data).slice(0, 7)}`
    : null;
  try {
    const [result] = await pool.query(
      `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, aluno_id, origem, recorrente, recorrencia_meses, dedup_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.academiaId, t.data, t.grupo, t.categoria, t.descricao || null, t.valor || 0, t.status, t.tipo, t.alunoId || null, t.origem || null, t.recorrente ? 1 : 0, t.recorrenciaMeses || null, dedupKey]
    );
    const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
    res.json(txToJSON(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY' && dedupKey) {
      const [existing] = await pool.query('SELECT * FROM transactions WHERE academia_id = ? AND dedup_key = ?', [req.academiaId, dedupKey]);
      if (existing[0]) return res.json(txToJSON(existing[0]));
    }
    throw e;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const t = req.body;
  const v = readVersion(req, res); if (v === null) return;
  const where = 'id=? AND academia_id=?', ids = [req.params.id, req.academiaId];
  const ok = await updateLocked('transactions', 'data=?, grupo=?, categoria=?, descricao=?, valor=?, status=?, tipo=?, aluno_id=?, origem=?, recorrente=?, recorrencia_meses=?',
    [t.data, t.grupo, t.categoria, t.descricao || null, t.valor || 0, t.status, t.tipo, t.alunoId || null, t.origem || null, t.recorrente ? 1 : 0, t.recorrenciaMeses || null], where, ids, v);
  await replyLockResult(res, ok, v, 'transactions', where, ids, 'Lançamento não encontrado.');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM transactions WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
