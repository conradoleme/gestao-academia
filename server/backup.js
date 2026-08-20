/* Backup automático do banco: dump em SQL puro (via mysql2 — a mesma
   conexão que o app já usa) comprimido e enviado pro Cloudflare R2
   (compatível com a API S3). Roda agendado (backup-scheduler.js) e também
   pode ser disparado manualmente (POST /admin/backup-now) pra testar sem
   esperar o horário agendado.

   Não usamos o binário `mysqldump`: o pacote mariadb-client do Alpine não
   consegue carregar o plugin de autenticação caching_sha2_password que o
   MySQL 8+/9 exige (falha ao conectar), e instalar esse plugin à parte é
   mais frágil do que simplesmente gerar o dump em JS com o driver que já
   sabemos que funciona.

   Guardamos os últimos RETENTION_DIAS dias e apagamos o resto — sem isso
   o bucket cresceria pra sempre. */

const zlib = require('zlib');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('./db');

const RETENTION_DIAS = 14;

function r2Configurado() {
  return !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function dumpDatabaseSQL() {
  const [tableRows] = await pool.query('SHOW TABLES');
  const tableNames = tableRows.map(row => Object.values(row)[0]);

  let sql = `-- Backup gerado em ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

  for (const table of tableNames) {
    const [[createRow]] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
    const createStmt = createRow['Create Table'];
    sql += `DROP TABLE IF EXISTS \`${table}\`;\n${createStmt};\n\n`;

    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    if (rows.length) {
      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `\`${c}\``).join(', ');
      for (const row of rows) {
        const values = columns.map(c => pool.escape(row[c])).join(', ');
        sql += `INSERT INTO \`${table}\` (${colList}) VALUES (${values});\n`;
      }
      sql += '\n';
    }
  }

  sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
  return sql;
}

async function limparBackupsAntigos(s3, prefix) {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: prefix }));
  const cutoff = Date.now() - RETENTION_DIAS * 24 * 60 * 60 * 1000;
  let removidos = 0;
  for (const obj of list.Contents || []) {
    if (obj.LastModified && obj.LastModified.getTime() < cutoff) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: obj.Key }));
      removidos++;
    }
  }
  return removidos;
}

async function runBackup() {
  if (!r2Configurado()) {
    return { ok: false, error: 'Backup não configurado (faltam variáveis R2_*).' };
  }

  const database = process.env.MYSQLDATABASE || process.env.DB_NAME;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${database}-${timestamp}.sql.gz`;

  try {
    const sql = await dumpDatabaseSQL();
    const gzipped = zlib.gzipSync(Buffer.from(sql, 'utf8'));

    const s3 = getR2Client();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: filename,
      Body: gzipped,
    }));

    const removidos = await limparBackupsAntigos(s3, `backup-${database}-`);

    console.log(`[backup] ${filename} enviado (${(gzipped.length / 1024 / 1024).toFixed(2)} MB). ${removidos} backup(s) antigo(s) removido(s).`);
    return { ok: true, filename, sizeMB: +(gzipped.length / 1024 / 1024).toFixed(2), removidos };
  } catch (e) {
    console.error('[backup] Falha:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { runBackup, r2Configurado };
