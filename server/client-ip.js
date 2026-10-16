/* IP real do cliente quando o app está atrás do Cloudflare.

   Cadeia: cliente → Cloudflare → borda do Railway → app. Com `trust proxy`, o
   Express enxerga como req.ip o IP que conectou no Railway — que, com o
   Cloudflare ligado, é o do PRÓPRIO Cloudflare (todo mundo pareceria o mesmo
   IP e o limite de login travaria todos juntos). O Cloudflare informa o IP
   verdadeiro em CF-Connecting-IP, mas esse cabeçalho só é confiável se a
   conexão realmente veio de um IP do Cloudflare — senão qualquer um forjaria
   o cabeçalho pra escapar do limite. Por isso conferimos as faixas abaixo.

   Faixas oficiais (https://www.cloudflare.com/ips). Mudam raramente; se
   ficarem desatualizadas o efeito é seguro: cai no req.ip (limite compartilhado).
   Dá pra sobrescrever sem redeploy com CLOUDFLARE_IPS="cidr1,cidr2,...". */
const net = require('net');
const crypto = require('crypto');

const FAIXAS_PADRAO = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

function paraBigInt(ip) {
  if (net.isIPv4(ip)) return ip.split('.').reduce((a, o) => (a << 8n) + BigInt(o), 0n);
  // IPv6: expande "::" e junta os grupos de 16 bits
  let [cabeca, cauda = ''] = ip.split('::');
  const g1 = cabeca ? cabeca.split(':') : [], g2 = cauda ? cauda.split(':') : [];
  const grupos = [...g1, ...Array(8 - g1.length - g2.length).fill('0'), ...g2];
  return grupos.reduce((a, g) => (a << 16n) + BigInt(parseInt(g || '0', 16)), 0n);
}

function dentroDaFaixa(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const v4 = net.isIPv4(base);
  if (net.isIPv4(ip) !== v4 || !net.isIP(ip)) return false;
  const total = v4 ? 32 : 128, bits = Number(bitsStr);
  const deslocamento = BigInt(total - bits);
  return (paraBigInt(ip) >> deslocamento) === (paraBigInt(base) >> deslocamento);
}

function normalizar(ip) {
  return typeof ip === 'string' ? ip.replace(/^::ffff:/i, '') : ip;
}

function faixas() {
  return process.env.CLOUDFLARE_IPS ? process.env.CLOUDFLARE_IPS.split(',').map(s => s.trim()).filter(Boolean) : FAIXAS_PADRAO;
}

function veioDoCloudflare(ipDoPar) {
  const ip = normalizar(ipDoPar);
  return !!ip && net.isIP(ip) > 0 && faixas().some(f => dentroDaFaixa(ip, f));
}

function ipDoCliente(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf && net.isIP(cf) && veioDoCloudflare(req.ip)) return normalizar(cf);
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

module.exports = { ipDoCliente, veioDoCloudflare, exigirOrigemVerificada };
