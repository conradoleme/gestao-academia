/* Backup automático do banco: dump completo via mysqldump, comprimido e
   enviado pro Cloudflare R2 (compatível com a API S3). Roda agendado
   (backup-scheduler.js) e também pode ser disparado manualmente
   (POST /admin/backup-now) pra testar sem esperar o horário agendado.

   Guardamos os últimos RETENTION_DIAS dias e apagamos o resto — sem isso
   o bucket cresceria pra sempre. */

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

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

function runMysqldump({ host, port, user, password, database, outPath }) {
  return new Promise((resolve, reject) => {
    const args = ['-h', host, '-P', String(port), '-u', user, '--single-transaction', '--routines', '--triggers', database];
    const dump = execFile('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: password }, // evita senha visível em `ps`
      maxBuffer: 1024 * 1024 * 1024, // 1GB — banco pequeno, mas dá margem
    });
    const gzip = require('zlib').createGzip();
    const out = fs.createWriteStream(outPath);

    let stderr = '';
    dump.stderr.on('data', chunk => { stderr += chunk; });
    dump.on('error', reject);

    dump.stdout.pipe(gzip).pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    dump.on('close', code => {
      if (code !== 0) reject(new Error(`mysqldump saiu com código ${code}: ${stderr}`));
    });
  });
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

  const host = process.env.MYSQLHOST || process.env.DB_HOST;
  const port = process.env.MYSQLPORT || process.env.DB_PORT || 3306;
  const user = process.env.MYSQLUSER || process.env.DB_USER;
  const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${database}-${timestamp}.sql.gz`;
  const tmpPath = path.join(os.tmpdir(), filename);

  try {
    await runMysqldump({ host, port, user, password, database, outPath: tmpPath });

    const stats = fs.statSync(tmpPath);
    const s3 = getR2Client();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: filename,
      Body: fs.readFileSync(tmpPath),
    }));

    const removidos = await limparBackupsAntigos(s3, `backup-${database}-`);

    console.log(`[backup] ${filename} enviado (${(stats.size / 1024 / 1024).toFixed(2)} MB). ${removidos} backup(s) antigo(s) removido(s).`);
    return { ok: true, filename, sizeMB: +(stats.size / 1024 / 1024).toFixed(2), removidos };
  } catch (e) {
    console.error('[backup] Falha:', e.message);
    return { ok: false, error: e.message };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

module.exports = { runBackup, r2Configurado };
