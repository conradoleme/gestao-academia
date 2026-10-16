/* Restaura um backup cifrado: lê o arquivo .enc baixado do R2 e grava o SQL
   comprimido (.sql.gz) no caminho de saída. Precisa da mesma DATA_ENCRYPTION_KEY.

   Uso: DATA_ENCRYPTION_KEY=... node server/scripts/decrypt-backup.js backup-xxx.sql.gz.enc saida.sql.gz */
const fs = require('fs');
const { descriptografarArquivo } = require('../crypto');

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) { console.error('Uso: node server/scripts/decrypt-backup.js <backup.enc> <saida.sql.gz>'); process.exit(1); }
fs.writeFileSync(saida, descriptografarArquivo(fs.readFileSync(entrada)));
console.log('Backup descriptografado em', saida);
