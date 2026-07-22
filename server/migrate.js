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

  await addColumnIfMissing('academias', 'status_pagamento', `VARCHAR(20) NOT NULL DEFAULT 'ativo'`);
  await addColumnIfMissing('academias', 'valor_mensal', `DECIMAL(10,2) NOT NULL DEFAULT 0`);
  await addColumnIfMissing('academias', 'proximo_vencimento', `DATE NULL`);
}

/* ALTER TABLE ... ADD COLUMN é seguro rodar de novo a cada boot só se a
   coluna ainda não existir — tabelas criadas antes deste campo existir
   (como a academia já em produção) precisam desse passo além do
   CREATE TABLE IF NOT EXISTS, que não altera tabelas já existentes. */
async function addColumnIfMissing(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].total === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Coluna ${table}.${column} adicionada.`);
  }
}

module.exports = migrate;
