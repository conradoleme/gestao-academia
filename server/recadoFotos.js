/* Fotos de recado — o recado só carrega os ids; o navegador pede o link
   temporário de cada foto separado (ver GET /recados/:id/fotos). */
const pool = require('./db');
const { recadoToJSON } = require('./mappers');
const { r2Apagar } = require('./r2');

async function recadosComFotos(rows, academiaId) {
  if (!rows.length) return [];
  const [fotos] = await pool.query(
    'SELECT id, recado_id FROM recado_fotos WHERE academia_id = ? AND recado_id IN (?) ORDER BY id',
    [academiaId, rows.map(r => r.id)]
  );
  const porRecado = new Map();
  fotos.forEach(f => { if (!porRecado.has(f.recado_id)) porRecado.set(f.recado_id, []); porRecado.get(f.recado_id).push(String(f.id)); });
  return rows.map(r => ({ ...recadoToJSON(r), fotos: porRecado.get(r.id) || [] }));
}

// Apaga os arquivos no R2 dos recados informados (o vínculo no banco some em cascata).
async function apagarFotosDosRecados(academiaId, recadoIds) {
  if (!recadoIds.length) return;
  const [rows] = await pool.query('SELECT r2_key FROM recado_fotos WHERE academia_id = ? AND recado_id IN (?)', [academiaId, recadoIds]);
  await r2Apagar(rows.map(r => r.r2_key));
}

module.exports = { recadosComFotos, apagarFotosDosRecados };
