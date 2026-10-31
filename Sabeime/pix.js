/* =====================================================
   PIX.JS: monta o Pix "copia e cola" e o QR code com o valor
   do pedido, direto no aparelho do cliente. Não usa banco,
   API nem internet. O dinheiro vai direto para a chave Pix
   que está em PIX (no comum.js).
   ===================================================== */

// ---------- 1. Código Pix copia e cola (padrão do Banco Central) ----------
const campo = (id, valor) => id + String(valor.length).padStart(2, "0") + valor;
const limparPix = (texto, max) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max);

// "Dígito de conferência" do código (CRC16), que os bancos usam para saber se o código está inteiro
function crc16(texto) {
  let crc = 0xFFFF;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function codigoPix(valor) {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", PIX.chave);
  const corpo = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986")
    + campo("54", Number(valor).toFixed(2)) + campo("58", "BR")
    + campo("59", limparPix(PIX.nome, 25)) + campo("60", limparPix(PIX.cidade, 15))
    + campo("62", campo("05", "***")) + "6304";
  return corpo + crc16(corpo);
}

// ---------- 2. QR code (versões 1 a 10, correção M) ----------
function qrMatriz(texto) {
  const dados = Array.from(new TextEncoder().encode(texto));
  // por versão: [bytes de correção por bloco, nº de blocos do grupo 1, dados por bloco, nº de blocos do grupo 2, dados por bloco]
  const TAB = { 1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0],
    6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44] };
  let v = 1, t, cap;
  for (; v <= 10; v++) {
    t = TAB[v]; cap = t[1] * t[2] + t[3] * t[4];
    if (dados.length * 8 + 4 + (v < 10 ? 8 : 16) <= cap * 8) break;
  }
  if (v > 10) throw new Error("texto grande demais para o QR code");

  // dados em bits: modo "bytes" + tamanho + texto + enchimento
  const bits = [];
  const poe = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  poe(4, 4); poe(dados.length, v < 10 ? 8 : 16); dados.forEach(b => poe(b, 8));
  poe(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) poe(pad, 8);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // correção de erros (Reed-Solomon)
  const exp = [], log = []; let x = 1;
  for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  const mul = (a, b) => a && b ? exp[(log[a] + log[b]) % 255] : 0;
  const ec = t[0];
  let gen = [1];
  for (let i = 0; i < ec; i++) { const n = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { n[j] ^= c; n[j + 1] ^= mul(c, exp[i]); }); gen = n; }
  const resto = bloco => {
    const r = new Array(ec).fill(0);
    for (const b of bloco) { const f = b ^ r[0]; r.shift(); r.push(0); if (f) for (let i = 0; i < ec; i++) r[i] ^= mul(gen[i + 1], f); }
    return r;
  };
  const blocos = []; let pos = 0;
  for (let g = 0; g < 2; g++) for (let k = 0; k < t[1 + g * 2]; k++) { blocos.push(cw.slice(pos, pos + t[2 + g * 2])); pos += t[2 + g * 2]; }
  const tudo = [], maior = Math.max(...blocos.map(b => b.length));
  for (let i = 0; i < maior; i++) blocos.forEach(b => { if (i < b.length) tudo.push(b[i]); });
  const correcoes = blocos.map(resto);
  for (let i = 0; i < ec; i++) correcoes.forEach(r => tudo.push(r[i]));
  const fluxo = [];
  tudo.forEach(b => { for (let i = 7; i >= 0; i--) fluxo.push((b >> i) & 1); });
  if (v >= 2 && v <= 6) for (let i = 0; i < 7; i++) fluxo.push(0);

  // desenho: cantos, linhas de alinhamento e áreas reservadas
  const N = 17 + 4 * v;
  const novo = () => Array.from({ length: N }, () => new Array(N).fill(0));
  const base = novo(), fixo = novo();
  const set = (m, r, c, val) => { if (r >= 0 && r < N && c >= 0 && c < N) { m[r][c] = val; fixo[r][c] = 1; } };
  const canto = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const cheio = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(base, r0 + dr, c0 + dc, cheio ? 1 : 0);
    }
  };
  canto(0, 0); canto(0, N - 7); canto(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { set(base, 6, i, i % 2 ? 0 : 1); set(base, i, 6, i % 2 ? 0 : 1); }
  const AL = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }[v];
  const ultimo = AL[AL.length - 1];
  for (const r of AL) for (const c of AL) {
    if ((r === 6 && c === 6) || (r === 6 && c === ultimo) || (r === ultimo && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(base, r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1);
  }
  for (let i = 0; i < 9; i++) { set(base, 8, i, 0); set(base, i, 8, 0); }   // reserva dos dados de formato
  for (let i = 0; i < 8; i++) { set(base, 8, N - 1 - i, 0); set(base, N - 1 - i, 8, 0); }
  set(base, N - 8, 8, 1);
  if (v >= 7) {
    let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const info = (v << 12) | rem;
    for (let i = 0; i < 18; i++) { const cor = (info >>> i) & 1, a = N - 11 + i % 3, b = Math.floor(i / 3); set(base, b, a, cor); set(base, a, b, cor); }
  }
  // coloca os dados em zigue-zague
  let k = 0, sobe = true;
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c = 5;
    for (let i = 0; i < N; i++) {
      const r = sobe ? N - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) if (!fixo[r][c - dc]) base[r][c - dc] = k < fluxo.length ? fluxo[k++] : 0;
    }
    sobe = !sobe;
  }

  // escolhe o "padrão de máscara" que deixa o QR mais fácil de ler
  const MASC = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  const penalidade = g => {
    let p = 0;
    for (let a = 0; a < N; a++) for (const linha of [true, false]) {
      let cor = -1, n = 0, s = "";
      for (let b = 0; b < N; b++) {
        const z = linha ? g[a][b] : g[b][a]; s += z;
        if (z === cor) { n++; if (n === 5) p += 3; else if (n > 5) p++; } else { cor = z; n = 1; }
      }
      for (const padrao of ["10111010000", "00001011101"]) { let i = -1; while ((i = s.indexOf(padrao, i + 1)) >= 0) p += 40; }
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
    const escuros = g.flat().filter(z => z).length;
    return p + 10 * Math.floor(Math.abs(escuros * 100 / (N * N) - 50) / 5);
  };
  let melhor = null, menor = Infinity;
  for (let m = 0; m < 8; m++) {
    const g = base.map(l => l.slice());
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!fixo[r][c] && MASC[m](r, c)) g[r][c] ^= 1;
    let rem = m; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((m << 10) | rem) ^ 0x5412, bit = i => (f >>> i) & 1;   // correção "M" = 00
    for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
    g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) g[8][N - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) g[N - 15 + i][8] = bit(i);
    g[N - 8][8] = 1;
    const p = penalidade(g);
    if (p < menor) { menor = p; melhor = g; }
  }
  return melhor;
}

// Desenho do QR code como imagem (SVG), com margem branca em volta
function qrSvg(texto) {
  const g = qrMatriz(texto), N = g.length, q = 4;
  let d = "";
  g.forEach((linha, r) => linha.forEach((z, c) => { if (z) d += `M${c + q} ${r + q}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N + 2 * q} ${N + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="QR code do Pix"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
