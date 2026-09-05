/* Aplica server/schema.sql no boot — todas as tabelas usam CREATE TABLE IF
   NOT EXISTS, então rodar de novo a cada deploy é seguro (idempotente).
   Existe pra não depender de ter um cliente mysql instalado localmente. */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Remove comentários (linha inteira ou só o final da linha) ANTES de
  // dividir por ";" — um ";" dentro de um comentário já quebrou isso antes
  // (dividia uma única CREATE TABLE em dois pedaços inválidos).
  const semComentarios = sql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
  const statements = semComentarios
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(`Schema aplicado (${statements.length} comando(s)).`);

  await addColumnIfMissing('academias', 'status_pagamento', `VARCHAR(20) NOT NULL DEFAULT 'ativo'`);
  await addColumnIfMissing('academias', 'valor_mensal', `DECIMAL(10,2) NOT NULL DEFAULT 0`);
  await addColumnIfMissing('academias', 'proximo_vencimento', `DATE NULL`);
  await addColumnIfMissing('transactions', 'recorrente', `TINYINT(1) NOT NULL DEFAULT 0`);
  await addColumnIfMissing('transactions', 'recorrencia_meses', `INT NULL`);
  await addColumnIfMissing('academias', 'logo_key', `VARCHAR(255) NULL`);
  await addColumnIfMissing('academias', 'watermark_ativo', `TINYINT(1) NOT NULL DEFAULT 0`);
  await addColumnIfMissing('academias', 'graduacao_regras', `JSON NULL`);
  await addColumnIfMissing('students', 'data_inicio', `DATE NULL`);
  await addColumnIfMissing('students', 'faixa', `VARCHAR(30) NULL`);
  await addColumnIfMissing('students', 'grau', `INT NOT NULL DEFAULT 0`);
  await addColumnIfMissing('fichas_medicas', 'hospital_preferencia', `VARCHAR(150) NULL`);
  await addColumnIfMissing('fichas_medicas', 'plano_saude', `VARCHAR(100) NULL`);
  await addColumnIfMissing('fichas_medicas', 'numero_carteirinha', `VARCHAR(60) NULL`);
  await addColumnIfMissing('academias', 'slug', `VARCHAR(60) NULL UNIQUE`);
  await addColumnIfMissing('academias', 'usa_grau', `TINYINT(1) NOT NULL DEFAULT 1`);
  await addColumnIfMissing('academias', 'stripe_customer_id', `VARCHAR(255) NULL`);
  await addColumnIfMissing('academias', 'stripe_subscription_id', `VARCHAR(255) NULL`);

  // Trava contra mensalidade/matrícula duplicada quando duas sessões (ex:
  // dono e um funcionário logando quase ao mesmo tempo) disparam a geração
  // automática do mesmo mês antes de uma ver o que a outra acabou de criar.
  // Coluna simples (não gerada pelo MySQL — coluna GENERATED conflita com
  // as foreign keys que essa tabela já tem): quem grava calcula o valor
  // (server/routes/mensalidades.js) só pra lançamentos auto-*; os manuais
  // ficam NULL e nunca colidem, já que UNIQUE não trava múltiplos NULLs.
  await addColumnIfMissing('transactions', 'dedup_key', `VARCHAR(255) NULL`);
  // Preenche o valor pros lançamentos auto-* que já existiam antes dessa
  // coluna existir — sem isso a trava só protegeria lançamento novo daqui
  // pra frente. Idempotente: só mexe em quem ainda está NULL.
  await pool.query(
    `UPDATE transactions SET dedup_key = CONCAT(academia_id,'|',aluno_id,'|',categoria,'|',data,'|',origem)
     WHERE origem IN ('auto-mensalidade','auto-matricula') AND aluno_id IS NOT NULL AND dedup_key IS NULL`
  );
  await addUniqueIndexIfMissing('transactions', 'uq_transactions_dedup', 'dedup_key');
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

/* Mesma ideia do addColumnIfMissing, mas pra criar um índice único sem
   quebrar se já existir (redeploy) nem se dados antigos violassem a
   trava — nesse caso ela não é a causa, então preferimos avisar no log a
   travar o boot. */
async function addUniqueIndexIfMissing(table, indexName, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (rows[0].total === 0) {
    try {
      await pool.query(`ALTER TABLE ${table} ADD UNIQUE KEY ${indexName} (${column})`);
      console.log(`Índice único ${indexName} criado em ${table}.${column}.`);
    } catch (e) {
      console.error(`Não deu pra criar o índice único ${indexName} (dado existente pode colidir):`, e.message);
    }
  }
}

module.exports = migrate;
