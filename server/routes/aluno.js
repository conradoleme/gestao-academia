/* Portal do aluno — acesso restrito só aos próprios dados. Diferente das
   rotas em /api/*, aqui NÃO existe visão da academia inteira: cada consulta
   é presa a req.alunoId (vindo do token), nunca a um id recebido do cliente. */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { studentToJSON, turmaToJSON, txToJSON } = require('../mappers');

router.use((req, res, next) => {
  if (req.role !== 'aluno') return res.status(403).json({ error: 'Acesso restrito ao portal do aluno.' });
  if (!req.alunoId) return res.status(404).json({ error: 'Este acesso não está vinculado a um aluno.' });
  next();
});

router.get('/me', async (req, res) => {
  const [studentRows] = await pool.query('SELECT * FROM students WHERE id = ? AND academia_id = ?', [req.alunoId, req.academiaId]);
  if (!studentRows[0]) return res.status(404).json({ error: 'Aluno não encontrado.' });

  const [txRows] = await pool.query(
    'SELECT * FROM transactions WHERE aluno_id = ? AND academia_id = ? ORDER BY data DESC',
    [req.alunoId, req.academiaId]
  );
  const [turmaRows] = await pool.query('SELECT * FROM turmas WHERE academia_id = ?', [req.academiaId]);
  const [academiaRows] = await pool.query('SELECT nome FROM academias WHERE id = ?', [req.academiaId]);

  res.json({
    academiaNome: academiaRows[0]?.nome || '',
    aluno: studentToJSON(studentRows[0]),
    pagamentos: txRows.map(txToJSON),
    turmas: turmaRows.map(turmaToJSON),
  });
});

router.put('/senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });

  const [rows] = await pool.query('SELECT senha_hash FROM usuarios WHERE id = ?', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!ok) return res.status(400).json({ error: 'Senha atual incorreta.' });

  const novoHash = await bcrypt.hash(novaSenha, 10);
  await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novoHash, req.userId]);
  res.json({ ok: true });
});

module.exports = router;
