/* Criptografia em nível de campo (dados de saúde) e de arquivo (backup).

   AES-256-GCM: além de embaralhar, detecta adulteração. A chave vem da variável
   DATA_ENCRYPTION_KEY (32 bytes em base64) — fica FORA do banco, então quem
   obtém só o banco ou só o backup não consegue ler os dados. PERDER A CHAVE =
   PERDER OS DADOS cifrados: guarde uma cópia num cofre de senhas.

   Texto cifrado: "enc:v1:<iv>:<tag>:<dados>" (base64). Valor sem esse prefixo é
   dado antigo, em texto aberto — continua legível (migração gradual). */
const crypto = require('crypto');

const PREFIXO_TEXTO = 'enc:v1:';
const MAGICO_ARQUIVO = Buffer.from('MTBK1');

function chave() {
  const b64 = process.env.DATA_ENCRYPTION_KEY;
  if (!b64) return null;
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY inválida: precisa de 32 bytes em base64.');
  return k;
}

function criptografiaAtiva() { return !!chave(); }

let avisouSemChave = false;
function criptografarTexto(texto) {
  if (texto === null || texto === undefined || texto === '') return texto;
  if (typeof texto === 'string' && texto.startsWith(PREFIXO_TEXTO)) return texto;
  const k = chave();
  if (!k) {
    if (!avisouSemChave) { console.warn('[cripto] DATA_ENCRYPTION_KEY ausente — gravando dado sensível SEM criptografia.'); avisouSemChave = true; }
    return texto;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return PREFIXO_TEXTO + [iv, cipher.getAuthTag(), dados].map(b => b.toString('base64')).join(':');
}

function descriptografarTexto(valor) {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIXO_TEXTO)) return valor;
  const k = chave();
  if (!k) throw new Error('Dado cifrado, mas DATA_ENCRYPTION_KEY não está configurada.');
  const [iv, tag, dados] = valor.slice(PREFIXO_TEXTO.length).split(':').map(s => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString('utf8');
}

// Arquivo (backup): MAGICO + iv(12) + tag(16) + dados
function criptografarArquivo(buffer) {
  const k = chave();
  if (!k) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGICO_ARQUIVO, iv, cipher.getAuthTag(), dados]);
}

function descriptografarArquivo(buffer) {
  const k = chave();
  if (!k) throw new Error('DATA_ENCRYPTION_KEY não está configurada.');
  if (!buffer.subarray(0, MAGICO_ARQUIVO.length).equals(MAGICO_ARQUIVO)) throw new Error('Arquivo não é um backup criptografado do MeuTatame.');
  let o = MAGICO_ARQUIVO.length;
  const iv = buffer.subarray(o, o + 12); o += 12;
  const tag = buffer.subarray(o, o + 16); o += 16;
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(o)), decipher.final()]);
}

module.exports = { criptografiaAtiva, criptografarTexto, descriptografarTexto, criptografarArquivo, descriptografarArquivo, PREFIXO_TEXTO };
