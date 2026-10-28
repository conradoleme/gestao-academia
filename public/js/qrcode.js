/* Gerador de QR code, sem dependências (o CSP do sistema só aceita scripts do próprio site).
   Modo byte (UTF-8), versões 1 a 10, correção de erro L, M ou Q — sobra para um endereço de
   academia. Segue a ISO 18004; conferido lendo os códigos gerados com um leitor de verdade.

   Uso: qrMatriz('https://meutatameapp.com.br/minha-academia', 'M') → matriz[linha][coluna] = true (módulo escuro) */

const QR_BLOCOS = {
  // nível → versão (1..10) → [códigos de correção por bloco, [[nº de blocos, códigos de dados por bloco], ...]]
  L: [null, [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]], [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]]],
  M: [null, [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]], [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]]],
  Q: [null, [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]], [24, [[4, 19]]], [18, [[2, 14], [4, 15]]], [22, [[4, 18], [2, 19]]], [20, [[4, 16], [4, 17]]], [24, [[6, 19], [2, 20]]]],
};
const QR_BITS_NIVEL = { L: 1, M: 0, Q: 3 };
const QR_ALINHAMENTO = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const QR_EXP = new Array(512);
const QR_LOG = new Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { QR_EXP[i] = x; QR_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
})();
function qrMul(a, b) { return a === 0 || b === 0 ? 0 : QR_EXP[QR_LOG[a] + QR_LOG[b]]; }

function qrRestoRS(dados, nEc) {
  let g = [1];
  for (let i = 0; i < nEc; i++) {
    const prox = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { prox[j] ^= g[j]; prox[j + 1] ^= qrMul(g[j], QR_EXP[i]); }
    g = prox;
  }
  const r = dados.concat(new Array(nEc).fill(0));
  for (let i = 0; i < dados.length; i++) {
    const c = r[i];
    if (c !== 0) for (let j = 0; j < g.length; j++) r[i + j] ^= qrMul(g[j], c);
  }
  return r.slice(dados.length);
}

function qrUtf8(texto) {
  return Array.from(new TextEncoder().encode(texto));
}

function qrCodewords(bytes, versao, nivel) {
  const [ec, grupos] = QR_BLOCOS[nivel][versao];
  const totalDados = grupos.reduce((s, [n, d]) => s + n * d, 0);
  const bits = [];
  const poe = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poe(0b0100, 4);
  poe(bytes.length, versao < 10 ? 8 : 16);
  bytes.forEach(b => poe(b, 8));
  const capacidade = totalDados * 8;
  poe(0, Math.min(4, capacidade - bits.length));
  while (bits.length % 8) bits.push(0);
  const dados = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; dados.length < totalDados; pad ^= 0xec ^ 0x11) dados.push(pad);

  const blocosDados = [], blocosEc = [];
  let pos = 0;
  grupos.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const b = dados.slice(pos, pos + d); pos += d; blocosDados.push(b); blocosEc.push(qrRestoRS(b, ec)); } });
  const saida = [];
  const maxD = Math.max(...blocosDados.map(b => b.length));
  for (let i = 0; i < maxD; i++) blocosDados.forEach(b => { if (i < b.length) saida.push(b[i]); });
  for (let i = 0; i < ec; i++) blocosEc.forEach(b => saida.push(b[i]));
  return saida;
}

function qrEscolheVersao(nBytes, nivel) {
  for (let v = 1; v <= 10; v++) {
    const totalDados = QR_BLOCOS[nivel][v][1].reduce((s, [n, d]) => s + n * d, 0);
    if (4 + (v < 10 ? 8 : 16) + nBytes * 8 <= totalDados * 8) return v;
  }
  return 0;
}

function qrBit(valor, i) { return (valor >>> i) & 1; }

function qrMontaMatriz(codewords, versao, nivel, mascara) {
  const n = 17 + 4 * versao;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixo = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x, y, v) => { if (x >= 0 && x < n && y >= 0 && y < n) { m[y][x] = !!v; fixo[y][x] = true; } };

  // padrões de busca (os três quadrados dos cantos) com a borda clara
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  // linhas de sincronismo
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // entre os quadrados dos cantos
  // alinhamento
  const pos = QR_ALINHAMENTO[versao];
  pos.forEach((cy, i) => pos.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  const formato = (mask) => {
    const dados = (QR_BITS_NIVEL[nivel] << 3) | mask;
    let rem = dados;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((dados << 10) | rem) ^ 0x5412;
  };
  const desenhaFormato = (mask) => {
    const b = formato(mask);
    for (let i = 0; i <= 5; i++) set(8, i, qrBit(b, i));
    set(8, 7, qrBit(b, 6)); set(8, 8, qrBit(b, 7)); set(7, 8, qrBit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, qrBit(b, i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, qrBit(b, i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, qrBit(b, i));
    set(8, n - 8, true);
  };
  desenhaFormato(0); // só pra reservar as áreas; o valor certo entra depois da máscara

  if (versao >= 7) {
    let rem = versao;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (versao << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, qrBit(bits, i)); set(b, a, qrBit(bits, i));
    }
  }

  // dados em zigue-zague, de baixo pra cima, de 2 em 2 colunas
  const bitsDados = [];
  codewords.forEach(c => { for (let i = 7; i >= 0; i--) bitsDados.push((c >>> i) & 1); });
  let idx = 0;
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5; // a coluna 6 é a linha de sincronismo
    const sobe = ((dir + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const y = sobe ? n - 1 - k : k;
      for (let d = 0; d < 2; d++) {
        const x = dir - d;
        if (fixo[y][x]) continue;
        m[y][x] = idx < bitsDados.length ? bitsDados[idx] === 1 : false;
        idx++;
      }
    }
  }

  // máscara
  const cond = [
    (i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => (i * j) % 2 + (i * j) % 3 === 0,
    (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0, (i, j) => ((i + j) % 2 + (i * j) % 3) % 2 === 0,
  ][mascara];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixo[y][x] && cond(y, x)) m[y][x] = !m[y][x];
  desenhaFormato(mascara);
  return m;
}

function qrPenalidade(m) {
  const n = m.length;
  let p = 0;
  const linhas = [], colunas = [];
  for (let i = 0; i < n; i++) { linhas.push(m[i]); colunas.push(m.map(r => r[i])); }
  for (const seq of linhas.concat(colunas)) {
    let corrida = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && seq[i] === seq[i - 1]) corrida++;
      else { if (corrida >= 5) p += 3 + (corrida - 5); corrida = 1; }
    }
    const txt = seq.map(b => (b ? '1' : '0')).join('');
    for (const padrao of ['000010111010', '010111010000']) {
      let i = -1;
      while ((i = txt.indexOf(padrao, i + 1)) !== -1) p += 40;
    }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  let escuros = 0;
  m.forEach(r => r.forEach(c => { if (c) escuros++; }));
  p += (Math.ceil(Math.abs(escuros * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}

function qrMatriz(texto, nivel = 'M') {
  const bytes = qrUtf8(String(texto));
  const versao = qrEscolheVersao(bytes.length, nivel);
  if (!versao) throw new Error('Texto longo demais para o QR code.');
  const codewords = qrCodewords(bytes, versao, nivel);
  let melhor = null, menor = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = qrMontaMatriz(codewords, versao, nivel, mascara);
    const p = qrPenalidade(m);
    if (p < menor) { menor = p; melhor = m; }
  }
  return melhor;
}
