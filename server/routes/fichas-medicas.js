/* Ficha médica — dado sensível (categoria especial pela LGPD). Fica fora
   do /api/bootstrap de propósito: só é buscada quando alguém realmente
   abre a ficha de um aluno específico, não em toda carga de página. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { fichaMedicaToJSON } = require('../mappers');
const { upsertFichaMedica, fichaMedicaVazia } = require('../fichaMedicaUpsert');
const asyncHandler = require('../asyncHandler');

router.get('/:alunoId', asyncHandler(async (req, res) => {
  const [studentRows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [req.params.alunoId, req.academiaId]);
  if (!studentRows[0]) return res.status(404).json({ error: 'Aluno não encontrado.' });

  const [rows] = await pool.query('SELECT * FROM fichas_medicas WHERE aluno_id = ? AND academia_id = ?', [req.params.alunoId, req.academiaId]);
  res.json(fichaMedicaToJSON(rows[0]) || fichaMedicaVazia(req.params.alunoId));
}));

router.put('/:alunoId', asyncHandler(async (req, res) => {
  const [studentRows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [req.params.alunoId, req.academiaId]);
  if (!studentRows[0]) return res.status(404).json({ error: 'Aluno não encontrado.' });

  const saved = await upsertFichaMedica(req.academiaId, req.params.alunoId, req.body || {});
  res.json(saved);
}));

module.exports = router;
