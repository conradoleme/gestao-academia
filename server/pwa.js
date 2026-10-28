/* PWA nível 1 (app instalável): manifesto por academia e validação do ícone enviado.
   O manifesto é montado na hora: cada academia instala com o próprio nome, logo e link. */

const ICONES_PADRAO = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const BASE = {
  display: 'standalone',
  orientation: 'portrait',
  lang: 'pt-BR',
  scope: '/',
  background_color: '#f2f3f7',
  theme_color: '#4a3fd6',
};

/* Nome que cabe embaixo do ícone (cerca de 12 letras): corta entre palavras, não no meio de uma. */
function nomeCurto(nome) {
  if (nome.length <= 12) return nome;
  let curto = '';
  for (const palavra of nome.split(/\s+/)) {
    const tentativa = curto ? `${curto} ${palavra}` : palavra;
    if (tentativa.length > 12) break;
    curto = tentativa;
  }
  return curto || nome.slice(0, 12);
}

function montarManifest(academia) {
  if (!academia || !academia.slug) {
    return { ...BASE, id: '/', name: 'Meu Tatame', short_name: 'Meu Tatame', description: 'Gestão para academias de artes marciais.', start_url: '/', icons: ICONES_PADRAO };
  }
  const nome = String(academia.nome || '').trim() || 'Academia';
  return {
    ...BASE,
    id: `/${academia.slug}`,
    name: nome,
    short_name: nomeCurto(nome),
    start_url: `/${academia.slug}`,
    icons: academia.icon_key
      ? [{ src: `/icone/${academia.id}`, sizes: '192x192 512x512', type: 'image/png', purpose: 'any' }]
      : ICONES_PADRAO,
  };
}

const ICONE_MAX_BYTES = 1536 * 1024; // PNG 512x512 de logo com muitos detalhes passa de 700KB
const ICONE_LADO = 512;
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* O ícone é gerado no navegador (canvas 512x512). Aqui só garantimos que é mesmo um PNG
   quadrado de 512 — nada de aceitar qualquer arquivo no armazenamento. */
function validarIconePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33) return 'Imagem inválida.';
  if (buffer.length > ICONE_MAX_BYTES) return 'Ícone muito grande.';
  if (!buffer.subarray(0, 8).equals(ASSINATURA_PNG)) return 'O ícone precisa ser um PNG.';
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return 'PNG inválido.';
  if (buffer.readUInt32BE(16) !== ICONE_LADO || buffer.readUInt32BE(20) !== ICONE_LADO) return `O ícone precisa ter ${ICONE_LADO}x${ICONE_LADO} pixels.`;
  return null;
}

module.exports = { nomeCurto, montarManifest, validarIconePng, ICONES_PADRAO };
