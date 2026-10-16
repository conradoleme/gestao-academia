/* Cifra as fichas médicas que já estavam gravadas em texto aberto.
   NÃO roda sozinho: por padrão só CONTA (simulação). Aplicar exige --apply, e
   sempre peça confirmação do dono antes de rodar em academia real.

   Uso:
     node server/scripts/encrypt-existing-fichas.js                    (simulação, todas as academias)
     node server/scripts/encrypt-existing-fichas.js --academia=ID      (simulação de uma academia)
     node server/scripts/encrypt-existing-fichas.js --academia=ID --apply */
const pool = require('../db');
const { criptografarTexto, criptografiaAtiva, PREFIXO_TEXTO } = require('../crypto');

const COLUNAS = ['contato_emergencia_nome', 'contato_emergencia_parentesco', 'contato_emergencia_telefone', 'tipo_sanguineo', 'alergias',
  'condicoes_medicas', 'medicamentos', 'lesoes_previas', 'restricao_pratica', 'hospital_preferencia', 'plano_saude',
  'numero_carteirinha', 'responsavel_legal_nome', 'responsavel_legal_telefone'];

(async () => {
  const apply = process.argv.includes('--apply');
  const arg = process.argv.find(a => a.startsWith('--academia='));
  const academiaId = arg ? Number(arg.split('=')[1]) : null;
  if (apply && !criptografiaAtiva()) { console.error('DATA_ENCRYPTION_KEY ausente — nada foi alterado.'); process.exit(1); }

  const [rows] = await pool.query(`SELECT * FROM fichas_medicas ${academiaId ? 'WHERE academia_id = ?' : ''}`, academiaId ? [academiaId] : []);
  let fichas = 0, campos = 0;
  for (const r of rows) {
    const sets = {};
    for (const c of COLUNAS) {
      if (r[c] && !String(r[c]).startsWith(PREFIXO_TEXTO)) sets[c] = criptografarTexto(r[c]);
    }
    const n = Object.keys(sets).length;
    if (!n) continue;
    fichas++; campos += n;
    if (apply) {
      // não mexe em version/updated_at-lógico: só troca o conteúdo pelo equivalente cifrado
      await pool.query(`UPDATE fichas_medicas SET ${Object.keys(sets).map(c => c + '=?').join(', ')}, updated_at = updated_at WHERE id = ?`, [...Object.values(sets), r.id]);
    }
  }
  console.log(`${apply ? 'CIFRADO' : 'SIMULAÇÃO'}: ${fichas} ficha(s), ${campos} campo(s) em texto aberto${apply ? ' agora cifrados' : ' seriam cifrados'}.`);
  process.exit(0);
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
