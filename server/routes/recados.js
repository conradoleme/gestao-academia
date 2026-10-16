/* Mural de recados — o instrutor posta um aviso global, pra uma turma, ou
   direto pra um aluno. Sem validade: fica visível até alguém apagar. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { recadoToJSON } = require('../mappers');
const crypto = require('crypto');
const { r2Configurado, r2Put, r2UrlTemporaria, r2Apagar } = require('../r2');
const { recadosComFotos, apagarFotosDosRecados } = require('../recadoFotos');
const asyncHandler = require('../asyncHandler');

const ALCANCES_VALIDOS = ['global', 'turma', 'aluno'];
const FOTOS_MAX = 4;
const FOTO_MAX_BYTES = 600 * 1024; // o navegador reduz pra ~300KB; isso é só o teto
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM recados WHERE academia_id = ? ORDER BY created_at DESC', [req.academiaId]);
  res.json(await recadosComFotos(rows, req.academiaId));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { alcance, turma, alunoId, titulo, mensagem } = req.body || {};
  const fotosEntrada = Array.isArray((req.body || {}).fotos) ? req.body.fotos : [];
  if (!titulo || !mensagem) return res.status(400).json({ error: 'Informe o título e a mensagem.' });
  if (!ALCANCES_VALIDOS.includes(alcance)) return res.status(400).json({ error: 'Alcance inválido.' });
  if (alcance === 'turma' && !turma) return res.status(400).json({ error: 'Selecione a turma.' });
  if (alcance === 'aluno' && !alunoId) return res.status(400).json({ error: 'Selecione o aluno.' });

  if (alcance === 'aluno') {
    const [rows] = await pool.query('SELECT id FROM students WHERE id = ? AND academia_id = ?', [alunoId, req.academiaId]);
    if (!rows[0]) return res.status(400).json({ error: 'Aluno não encontrado.' });
  }

  // Fotos: só em recado endereçado a UM aluno (privacidade — sobretudo Kids)
  // e só imagens comuns, já reduzidas pelo navegador.
  const fotos = [];
  if (fotosEntrada.length) {
    if (alcance !== 'aluno') return res.status(400).json({ error: 'Fotos só podem ser enviadas em recado para um aluno específico.' });
    if (!r2Configurado()) return res.status(503).json({ error: 'Envio de fotos não está configurado neste servidor.' });
    if (fotosEntrada.length > FOTOS_MAX) return res.status(400).json({ error: `Envie no máximo ${FOTOS_MAX} fotos por recado.` });
    for (const dataUrl of fotosEntrada) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
      if (!m) return res.status(400).json({ error: 'Foto inválida — use JPEG, PNG ou WEBP.' });
      const buffer = Buffer.from(m[2], 'base64');
      if (buffer.length > FOTO_MAX_BYTES) return res.status(400).json({ error: 'Foto muito grande depois de reduzida — tente outra.' });
      fotos.push({ mime: m[1], buffer });
    }
  }

  const [result] = await pool.query(
    `INSERT INTO recados (academia_id, alcance, turma, aluno_id, titulo, mensagem) VALUES (?,?,?,?,?,?)`,
    [req.academiaId, alcance, alcance === 'turma' ? turma : null, alcance === 'aluno' ? alunoId : null, titulo, mensagem]
  );
  const recadoId = result.insertId;
  const enviadas = [];
  try {
    for (const f of fotos) {
      const key = `fotos/${req.academiaId}/${recadoId}-${crypto.randomUUID()}.${EXT[f.mime]}`;
      await r2Put(key, f.buffer, f.mime);
      enviadas.push(key);
      await pool.query('INSERT INTO recado_fotos (academia_id, recado_id, r2_key, mime, bytes) VALUES (?,?,?,?,?)', [req.academiaId, recadoId, key, f.mime, f.buffer.length]);
    }
  } catch (e) {
    // não deixa recado pela metade nem arquivo órfão no R2
    await r2Apagar(enviadas);
    await pool.query('DELETE FROM recados WHERE id = ? AND academia_id = ?', [recadoId, req.academiaId]);
    throw e;
  }
  const [rows] = await pool.query('SELECT * FROM recados WHERE id = ?', [recadoId]);
  res.json((await recadosComFotos(rows, req.academiaId))[0]);
}));

// Links temporários (15 min) das fotos de um recado — o arquivo vem direto do R2.
router.get('/:id/fotos', asyncHandler(async (req, res) => {
  const [fotos] = await pool.query('SELECT id, r2_key FROM recado_fotos WHERE recado_id = ? AND academia_id = ? ORDER BY id', [req.params.id, req.academiaId]);
  if (!fotos.length || !r2Configurado()) return res.json([]);
  res.json(await Promise.all(fotos.map(async f => ({ id: String(f.id), url: await r2UrlTemporaria(f.r2_key) }))));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await apagarFotosDosRecados(req.academiaId, [req.params.id]);
  await pool.query('DELETE FROM recados WHERE id=? AND academia_id=?', [req.params.id, req.academiaId]);
  res.json({ ok: true });
}));

module.exports = router;
