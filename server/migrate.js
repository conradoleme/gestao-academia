/* Aplica server/schema.sql no boot — todas as tabelas usam CREATE TABLE IF
   NOT EXISTS, então rodar de novo a cada deploy é seguro (idempotente).
   Existe pra não depender de ter um cliente mysql instalado localmente. */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map(chunk => chunk
      .split('\n')
      .filter(line => !line.trim().startsWith('--')) // remove linhas de comentário antes de checar se sobrou SQL de verdade
      .join('\n')
      .trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(`Schema aplicado (${statements.length} comando(s)).`);
}

module.exports = migrate;
