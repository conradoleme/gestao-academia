/* Gestão de usuários adicionais da academia (operação/aluno) — só o dono
   (role 'admin', a própria linha em "academias") pode criar/editar/remover. */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireRole } = require('../auth');
const { usuarioToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

router.use(requireRole('admin'));

const ROLES_VALIDOS = ['operacao', 'aluno'];

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE academia_id = ? ORDER BY created_at DESC', [req.academiaId]);
  res.json(rows.map(usuarioToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { nome, email, senha, role, alunoId } = req.body || {};
  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ error: 'Preencha nome, e-mail, senha e papel.' });
  }
  if (!ROLES_VALIDOS.includes(role)) {
    return res.status(400).json({ error: 'Papel inválido.' });
  }
  if (senha.length < 8) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
  }
  if (role === 'aluno' && !alunoId) {
    return res.status(400).json({ error: 'Selecione o aluno vinculado a este acesso.' });
  }

  const [existingAcademia] = await pool.query('SELECT id FROM academias WHERE email = ?', [email]);
  const [existingUsuario] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existingAcademia[0] || existingUsuario[0]) {
    return res.status(409).json({ error: 'Já existe um acesso cadastrado com esse e-mail.' });
  }

  if (role === 'aluno') {
    const [studentRows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [alunoId, req.academiaId]);
    if (!studentRows[0]) return res.status(400).json({ error: 'Aluno não encontrado.' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const [result] = await pool.query(
    `INSERT INTO usuarios (academia_id, nome, email, senha_hash, role, aluno_id) VALUES (?,?,?,?,?,?)`,
    [req.academiaId, nome, email, senhaHash, role, role === 'aluno' ? alunoId : null]
  );
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);
  res.json(usuarioToJSON(rows[0]));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { nome, role, alunoId } = req.body || {};
  if (!nome || !role) return res.status(400).json({ error: 'Preencha nome e papel.' });
  if (!ROLES_VALIDOS.includes(role)) return res.status(400).json({ error: 'Papel inválido.' });
  if (role === 'aluno' && !alunoId) return res.status(400).json({ error: 'Selecione o aluno vinculado a este acesso.' });

  if (role === 'aluno') {
    const [studentRows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [alunoId, req.academiaId]);
    if (!studentRows[0]) return res.status(400).json({ error: 'Aluno não encontrado.' });
  }
  await pool.query(
    `UPDATE usuarios SET nome=?, role=?, aluno_id=? WHERE id=? AND academia_id=?`,
    [nome, role, role === 'aluno' ? alunoId : null, req.params.id, req.academiaId]
  );
  res.json({ ok: true });
}));

router.put('/:id/senha', asyncHandler(async (req, res) => {
  const { novaSenha } = req.body || {};
  if (!novaSenha || novaSenha.length < 8) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  }
  const novoHash = await bcrypt.hash(novaSenha, 10);
  await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ? AND academia_id = ?', [novoHash, req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM usuarios WHERE id = ? AND academia_id = ?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
