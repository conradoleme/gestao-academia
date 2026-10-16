/* IP real do cliente (usado pelo limite de tentativas de login).

   No Railway, `req.ip` (mesmo com `trust proxy`) é o IP de um salto INTERNO do
   Railway — dois endereços 46.151.194.x — e não o do cliente. Resultado: o
   limite contava todo mundo junto (dez tentativas erradas de qualquer pessoa
   travavam o login de todos). A borda do Railway grava o IP verdadeiro em
   X-Real-IP e SOBRESCREVE qualquer valor que o cliente mande (verificado:
   valor forjado chega trocado pelo IP real), tanto no acesso direto quanto
   por trás do Cloudflare. CF-Connecting-IP, ao contrário, passa forjado — por
   isso não é usado. Fora do Railway X-Real-IP seria forjável: ali cai no req.ip. */
const net = require('net');
const crypto = require('crypto');

const NO_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);

function normalizar(ip) {
  return typeof ip === 'string' ? ip.replace(/^::ffff:/i, '') : ip;
}

function ipDoCliente(req) {
  const real = req.headers['x-real-ip'];
  if (NO_RAILWAY && typeof real === 'string' && net.isIP(real.trim())) return normalizar(real.trim());
  return normalizar(req.ip);
}

/* Trava opcional: se ORIGIN_VERIFY_SECRET estiver definido, só aceita requisições
   que carreguem esse segredo no cabeçalho X-Origin-Verify (o Cloudflare o
   acrescenta por uma Transform Rule). Fecha o "atalho" de acessar o servidor
   direto pelo endereço do Railway e fugir do filtro do Cloudflare. Desligada
   por padrão. /health (checagem do Railway) e o webhook do Stripe (que já tem
   assinatura própria) ficam de fora. */
function exigirOrigemVerificada(req, res, next) {
  const segredo = process.env.ORIGIN_VERIFY_SECRET;
  if (!segredo || req.path === '/health' || req.path === '/webhooks/stripe') return next();
  const recebido = String(req.headers['x-origin-verify'] || '');
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(segredo).digest();
  if (crypto.timingSafeEqual(a, b)) return next();
  res.status(403).json({ error: 'Acesso direto não permitido.' });
}

module.exports = { ipDoCliente, exigirOrigemVerificada };
