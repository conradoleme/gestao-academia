/* Cartaz com QR code da academia: o aluno (ou o professor, ou o dono) aponta a câmera, cai no
   login da academia e instala o app. Tudo gerado aqui no navegador, a partir do link e do logo. */

const CARTAZ_LARGURA = 2480; // A4 a 300 dpi
const CARTAZ_ALTURA = 3508;
const CARTAZ_FONTE = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function cartazLink() {
  const slug = data && data.meta && data.meta.slug;
  return slug ? `${location.origin}/${slug}` : null;
}

function cartazCarregarImagem(url) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

/* Desenha só o QR (módulos pretos em fundo branco, com a margem de 4 módulos que a leitura exige). */
function cartazDesenharQr(ctx, texto, x, y, lado) {
  const matriz = qrMatriz(texto, 'M');
  const n = matriz.length;
  const modulo = Math.floor(lado / (n + 8));
  const tamanho = modulo * (n + 8);
  const ox = x + Math.floor((lado - tamanho) / 2), oy = y + Math.floor((lado - tamanho) / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (matriz[r][c]) ctx.fillRect(ox + (c + 4) * modulo, oy + (r + 4) * modulo, modulo, modulo);
  }
}

function cartazFonteQueCabe(ctx, texto, peso, maxLargura, maxTamanho) {
  let t = maxTamanho;
  do { ctx.font = `${peso} ${t}px ${CARTAZ_FONTE}`; t -= 6; } while (ctx.measureText(texto).width > maxLargura && t > 60);
  return t + 6;
}

function cartazRetanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function cartazMontar() {
  const link = cartazLink();
  if (!link) throw new Error('Defina o link da academia antes de gerar o QR code.');
  const nome = (data.meta.empresa || 'a academia').trim();
  const logo = await cartazCarregarImagem(data.meta.logoUrl || '/icons/icon-512.png');

  const canvas = document.createElement('canvas');
  canvas.width = CARTAZ_LARGURA; canvas.height = CARTAZ_ALTURA;
  const ctx = canvas.getContext('2d');
  const W = CARTAZ_LARGURA, centro = W / 2;
  const fundo = '#15182a', destaque = '#4a3fd6', claro = '#b9b3fb', texto = '#f4f3fb';

  ctx.fillStyle = fundo; ctx.fillRect(0, 0, W, CARTAZ_ALTURA);
  // faixa no topo, com a ponta preta e as listras (a marca do Meu Tatame)
  ctx.fillStyle = destaque; ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = fundo;
  [W - 330, W - 250, W - 170].forEach(x => ctx.fillRect(x, 0, 36, 130));

  // logo da academia, em círculo
  const D = 520, ly = 230;
  ctx.fillStyle = destaque; ctx.beginPath(); ctx.arc(centro, ly + D / 2, D / 2 + 24, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(centro, ly + D / 2, D / 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(centro - D / 2, ly, D, D);
  if (logo) {
    const esc = Math.min(D / logo.naturalWidth, D / logo.naturalHeight);
    const w = logo.naturalWidth * esc, h = logo.naturalHeight * esc;
    ctx.drawImage(logo, centro - w / 2, ly + (D - h) / 2, w, h);
  }
  ctx.restore();

  // título
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = texto;
  ctx.font = `800 300px ${CARTAZ_FONTE}`;
  const tamTitulo = cartazFonteQueCabe(ctx, 'INSTALE O APP', '800', W - 360, 300);
  ctx.font = `800 ${tamTitulo}px ${CARTAZ_FONTE}`;
  ctx.fillText('INSTALE O APP', centro, 1060);
  const linha2 = `DA ${nome}`.toUpperCase();
  const tamNome = cartazFonteQueCabe(ctx, linha2, '800', W - 360, tamTitulo);
  ctx.fillStyle = claro; ctx.font = `800 ${tamNome}px ${CARTAZ_FONTE}`;
  ctx.fillText(linha2, centro, 1060 + tamNome + 20);

  // subtítulo
  ctx.fillStyle = '#d3d0ee'; ctx.font = `500 64px ${CARTAZ_FONTE}`;
  ctx.fillText('Acompanhe sua evolução, a mensalidade, os recados', centro, 1060 + tamNome + 150);
  ctx.fillText('e as fotos das aulas direto do celular.', centro, 1060 + tamNome + 230);

  // QR dentro de um quadro branco
  const QR = 1240, qy = 1060 + tamNome + 330, qx = centro - QR / 2;
  ctx.fillStyle = destaque; cartazRetanguloArredondado(ctx, qx - 26, qy - 26, QR + 52, QR + 52, 90); ctx.fill();
  ctx.save(); cartazRetanguloArredondado(ctx, qx, qy, QR, QR, 64); ctx.clip();
  cartazDesenharQr(ctx, link, qx, qy, QR);
  ctx.restore();

  // chamada e passos
  const cy = qy + QR + 130;
  ctx.fillStyle = claro; ctx.font = `800 84px ${CARTAZ_FONTE}`;
  ctx.fillText('APONTE A CÂMERA DO CELULAR', centro, cy);

  const passos = [['1', 'Leia o código', 'com a câmera.'], ['2', 'Entre com seu', 'e-mail e senha.'], ['3', 'Toque em', 'Instalar o app.']];
  const colW = (W - 360) / 3;
  passos.forEach(([n, a, b], i) => {
    const px = 180 + i * colW;
    ctx.fillStyle = destaque; ctx.beginPath(); ctx.arc(px + 60, cy + 150, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `800 76px ${CARTAZ_FONTE}`; ctx.textAlign = 'center'; ctx.fillText(n, px + 60, cy + 178);
    ctx.textAlign = 'left'; ctx.fillStyle = texto; ctx.font = `700 56px ${CARTAZ_FONTE}`; ctx.fillText(a, px + 150, cy + 142);
    ctx.fillStyle = '#c9c6e6'; ctx.font = `500 56px ${CARTAZ_FONTE}`; ctx.fillText(b, px + 150, cy + 212);
  });

  ctx.textAlign = 'center'; ctx.fillStyle = '#8f8cb4'; ctx.font = `600 62px ${CARTAZ_FONTE}`;
  ctx.fillText(link.replace(/^https?:\/\//, ''), centro, CARTAZ_ALTURA - 110);
  return canvas;
}

function cartazBaixarArquivo(canvas, nomeArquivo) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

function cartazNomeArquivo(prefixo) {
  const slug = (data.meta.slug || 'academia').replace(/[^a-z0-9-]/gi, '');
  return `${prefixo}-${slug}.png`;
}

async function cartazBaixar() {
  try { cartazBaixarArquivo(await cartazMontar(), cartazNomeArquivo('cartaz-qr')); }
  catch (e) { showToast(e.message, 'error'); }
}

async function cartazBaixarSoQr() {
  try {
    const link = cartazLink();
    if (!link) throw new Error('Defina o link da academia antes de gerar o QR code.');
    const c = document.createElement('canvas'); c.width = c.height = 1400;
    cartazDesenharQr(c.getContext('2d'), link, 0, 0, 1400);
    cartazBaixarArquivo(c, cartazNomeArquivo('qr'));
  } catch (e) { showToast(e.message, 'error'); }
}

async function cartazImprimir() {
  try {
    const canvas = await cartazMontar();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}</style></head><body><img id="c" src="${canvas.toDataURL('image/png')}"></body></html>`);
    doc.close();
    const imprimir = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 60000); };
    const img = doc.getElementById('c');
    if (img.complete) imprimir(); else img.onload = imprimir;
  } catch (e) { showToast(e.message, 'error'); }
}

/* Pré-visualização pequena do QR na tela de Configurações. */
function cartazMostrarPreview() {
  const el = document.getElementById('cfg-qr-preview');
  const link = cartazLink();
  if (!el || !link) return;
  const c = document.createElement('canvas'); c.width = c.height = 400;
  cartazDesenharQr(c.getContext('2d'), link, 0, 0, 400);
  el.src = c.toDataURL('image/png');
}
