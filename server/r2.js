/* Cliente compartilhado do Cloudflare R2 (API compatível com S3) — usado
   pelo backup automático (server/backup.js) e pelo upload de logo das
   academias (server/routes/academia.js). Mesmo bucket, prefixos diferentes
   ("backup-..." vs "logos/..."). */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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

async function r2Put(key, buffer, contentType) {
  await getR2Client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

// Link temporário de leitura: o navegador baixa direto do R2 (o arquivo não
// passa pelo nosso servidor) e o endereço deixa de funcionar depois de expirar.
async function r2UrlTemporaria(key, segundos = 900) {
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }), { expiresIn: segundos });
}

async function r2Apagar(keys) {
  if (!r2Configurado()) return;
  const s3 = getR2Client();
  for (const k of keys) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: k })).catch(() => {});
  }
}

async function r2ApagarPrefixo(prefixo) {
  if (!r2Configurado()) return;
  const s3 = getR2Client();
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: prefixo, ContinuationToken: token })).catch(() => null);
    if (!r) return;
    await r2Apagar((r.Contents || []).map(o => o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
}

module.exports = { r2Configurado, getR2Client, r2Put, r2UrlTemporaria, r2Apagar, r2ApagarPrefixo };
