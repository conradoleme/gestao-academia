/* Páginas HTML servidas com a versão do deploy nos endereços de JS/CSS
   (js/app.js?v=ID). Motivo: o Cloudflare reescreve o cache dos arquivos .js/.css
   pra 4 horas no navegador, então quem já tinha o app aberto não via a publicação
   nova. Com a versão no endereço, cada deploy troca a URL e o navegador busca de novo. */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const cache = new Map();

function versionar(html, versao) {
  return html.replace(/\b(src|href)="((?:js|css)\/[^"?#]+)"/g, (_, attr, url) => `${attr}="${url}?v=${encodeURIComponent(versao)}"`);
}

function htmlVersionado(arquivo, versao) {
  if (!cache.has(arquivo)) cache.set(arquivo, versionar(fs.readFileSync(path.join(PUBLIC_DIR, arquivo), 'utf8'), versao));
  return cache.get(arquivo);
}

module.exports = { versionar, htmlVersionado };
