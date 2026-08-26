/* Normaliza texto livre (nome da academia, ou o que o admin digitar) num
   slug de URL: minusculo, sem acento, so letras/numeros separados por "-". */
const DIACRITICOS = new RegExp('[̀-ͯ]', 'g');

function slugify(text) {
  const semAcento = (text || '').toString().normalize('NFD').replace(DIACRITICOS, '');
  return semAcento
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* Gera um slug único pra academia — tenta o nome puro primeiro, senão
   vai acrescentando -2, -3... até achar um livre. excludeId serve pra
   permitir que a própria academia "renove" seu slug atual sem trombar
   consigo mesma na checagem de unicidade. */
async function generateUniqueSlug(pool, baseText, excludeId) {
  const base = slugify(baseText) || 'academia';
  let candidate = base;
  let n = 2;
  while (true) {
    const [rows] = excludeId
      ? await pool.query('SELECT id FROM academias WHERE slug = ? AND id != ?', [candidate, excludeId])
      : await pool.query('SELECT id FROM academias WHERE slug = ?', [candidate]);
    if (!rows[0]) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}

module.exports = { slugify, generateUniqueSlug };
