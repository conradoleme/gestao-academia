/* Cliente compartilhado do Cloudflare R2 (API compatível com S3) — usado
   pelo backup automático (server/backup.js) e pelo upload de logo das
   academias (server/routes/academia.js). Mesmo bucket, prefixos diferentes
   ("backup-..." vs "logos/..."). */

const { S3Client } = require('@aws-sdk/client-s3');

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

module.exports = { r2Configurado, getR2Client };
