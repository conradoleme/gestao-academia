const express = require('express');
const router = express.Router();
const pool = require('../db');
const { studentToJSON, turmaToJSON, txToJSON, academiaToShape } = require('../mappers');

/* Uma chamada só no login: tudo que o app precisa pra montar a tela inicial */
router.get('/bootstrap', async (req, res) => {
  const [academiaRows] = await pool.query('SELECT * FROM academias WHERE id = ?', [req.academiaId]);
  if (!academiaRows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
  const [turmaRows] = await pool.query('SELECT * FROM turmas WHERE academia_id = ?', [req.academiaId]);
  const [studentRows] = await pool.query('SELECT * FROM students WHERE academia_id = ?', [req.academiaId]);
  const [txRows] = await pool.query('SELECT * FROM transactions WHERE academia_id = ?', [req.academiaId]);

  const shape = academiaToShape(academiaRows[0]);
  res.json({
    ...shape,
    turmas: turmaRows.map(turmaToJSON),
    students: studentRows.map(studentToJSON),
    transactions: txRows.map(txToJSON),
  });
});

router.get('/academia', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM academias WHERE id = ?', [req.academiaId]);
  if (!rows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });
  res.json(academiaToShape(rows[0]));
});

router.put('/academia', async (req, res) => {
  const { meta, categoryGroups, cobrancaTemplates } = req.body;
  await pool.query(
    `UPDATE academias SET nome=?, tatame_comprimento=?, tatame_largura=?, concentracao_pico=?, generated_months=?, category_groups=?, cobranca_templates=?
     WHERE id=?`,
    [meta.empresa, meta.tatame.comprimento, meta.tatame.largura, meta.concentracaoPico,
     JSON.stringify(meta.generatedMonths || []), JSON.stringify(categoryGroups || {}), JSON.stringify(cobrancaTemplates || []),
     req.academiaId]
  );
  res.json({ ok: true });
});

module.exports = router;
