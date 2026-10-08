/* Trava otimista: cada linha editável tem uma "version". A tela guarda a
   versão que leu; ao gravar, só vale se a versão no banco ainda for essa.
   Se outra tela/pessoa gravou no meio, o servidor recusa (409) em vez de
   sobrescrever sem aviso — o último a salvar nunca apaga o trabalho do outro. */
const pool = require('./db');

const MSG_CONFLITO = 'Esta informação foi alterada em outra tela ou por outra pessoa. Atualize a página para ver a versão mais recente e refaça a alteração — assim nada é sobrescrito sem querer.';
const MSG_DESATUALIZADO = 'O sistema foi atualizado. Atualize a página para continuar.';

// Sem versão no pedido = tela antiga (aberta antes da trava existir): pede
// pra recarregar em vez de gravar sem checagem.
function readVersion(req, res, field = 'version', source = 'body') {
  const raw = source === 'query' ? req.query[field] : (req.body || {})[field];
  const v = Number.parseInt(raw, 10);
  if (!Number.isInteger(v) || v < 0) {
    res.status(409).json({ error: MSG_DESATUALIZADO, code: 'STALE_CLIENT' });
    return null;
  }
  return v;
}

function sendConflict(res) {
  res.status(409).json({ error: MSG_CONFLITO, code: 'VERSION_CONFLICT' });
}

// table/idWhere são sempre strings fixas do servidor, nunca vêm do cliente.
async function updateLocked(table, setSql, setParams, idWhere, idParams, version, db = pool) {
  const [r] = await db.query(
    `UPDATE ${table} SET ${setSql}, version = version + 1 WHERE ${idWhere} AND version = ?`,
    [...setParams, ...idParams, version]
  );
  return r.affectedRows === 1;
}

// Quando a gravação travada não pegou: ou a linha sumiu (404) ou mudou (409).
async function replyLockResult(res, ok, version, table, idWhere, idParams, notFoundMsg) {
  if (ok) return res.json({ ok: true, version: version + 1 });
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE ${idWhere}`, idParams);
  if (!rows[0]) return res.status(404).json({ error: notFoundMsg });
  return sendConflict(res);
}

module.exports = { readVersion, sendConflict, updateLocked, replyLockResult, MSG_CONFLITO, MSG_DESATUALIZADO };
