const express = require('express');
const router = express.Router();
const pool = require('../db');
const { txToJSON } = require('../mappers');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM transactions WHERE academia_id = ?', [req.academiaId]);
  res.json(rows.map(txToJSON));
});

router.post('/', async (req, res) => {
  const t = req.body;
  if (!t.data || !t.grupo || !t.categoria || !t.status || !t.tipo) {
    return res.status(400).json({ error: 'Dados incompletos para o lançamento.' });
  }
  const [result] = await pool.query(
    `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, aluno_id, origem, recorrente)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [req.academiaId, t.data, t.grupo, t.categoria, t.descricao || null, t.valor || 0, t.status, t.tipo, t.alunoId || null, t.origem || null, t.recorrente ? 1 : 0]
  );
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
  res.json(txToJSON(rows[0]));
});

router.put('/:id', async (req, res) => {
  const t = req.body;
  await pool.query(
    `UPDATE transactions SET data=?, grupo=?, categoria=?, descricao=?, valor=?, status=?, tipo=?, aluno_id=?, origem=?, recorrente=?
     WHERE id=? AND academia_id=?`,
    [t.data, t.grupo, t.categoria, t.descricao || null, t.valor || 0, t.status, t.tipo, t.alunoId || null, t.origem || null, t.recorrente ? 1 : 0, req.params.id, req.academiaId]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM transactions WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
});

module.exports = router;
