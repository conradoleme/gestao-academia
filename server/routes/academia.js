const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

router.put('/academia/senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });

  const [rows] = await pool.query('SELECT senha_hash FROM academias WHERE id = ?', [req.academiaId]);
  if (!rows[0]) return res.status(404).json({ error: 'Academia não encontrada.' });

  const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });

  const novoHash = await bcrypt.hash(novaSenha, 10);
  await pool.query('UPDATE academias SET senha_hash = ? WHERE id = ?', [novoHash, req.academiaId]);
  res.json({ ok: true });
});

module.exports = router;
