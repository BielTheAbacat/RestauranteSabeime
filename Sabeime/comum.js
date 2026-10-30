/* =====================================================
   COMUM.JS: o que o site e o painel usam juntos
   (configurações, ferramentas e o carregamento dos dados)
   ===================================================== */

/* =====================================================
   1. CONFIGURAÇÕES (o que você mais vai querer mudar)
   ===================================================== */

// Número do WhatsApp que recebe os pedidos: 55 (Brasil) + DDD + número, sem espaços.
const WHATS = "554399349260";

// Nome da "gaveta" onde o navegador guarda suas mudanças do painel.
const CHAVE = "sabeime_dados";

// Link para o cliente avaliar o restaurante no Google (aparece no final do site).
// O dono pode trocar ou apagar esse link no painel; enquanto não mexer, vale este.
const AVALIACAO_PADRAO = "https://search.google.com/local/writereview?placeid=ChIJpWmHL2g2wpQRylboVUajVrw";

// Endereço do seu Worker na Cloudflare (o "porteiro" que guarda os dados na nuvem).
// Exemplo: "https://sabeime-api.seunome.workers.dev"  (sem barra no final).
// Deixe vazio ("") para o site funcionar sem nuvem, só com o arquivo dados.json.
const API = "https://sabeimeapi.gabrielsantosestrela189.workers.dev";
const BASE = API.trim().replace(/\/+$/, "");   // tira espaços e barra sobrando no fim do endereço
let senha = "";       // senha do dono (só fica na memória enquanto o painel está aberto)

// Dados iniciais do restaurante (valem até o dono mudar algo no painel).
//  acomp  = itens que vêm no prato e o cliente pode tirar
//  carnes = quantas carnes o cliente pode escolher (0 = produto simples)
const PADRAO = {
  logo: "",
  cardapio: "",
  carnes: [],
  produtos: [
    { id: "pf",  nome: "Prato Feito",       preco: 24, foto: "", esgotado: false, acomp: ["Arroz", "Feijão", "Farofa", "Macarrão"], carnes: 2 },
    { id: "eco", nome: "Marmita Econômica", preco: 15, foto: "", esgotado: false, acomp: ["Arroz", "Feijão", "Farofa", "Macarrão"], carnes: 1 },
    { id: "p",   nome: "Marmita P",         preco: 22, foto: "", esgotado: false, acomp: ["Arroz", "Feijão", "Farofa", "Macarrão"], carnes: 2 },
    { id: "m",   nome: "Marmita M",         preco: 24, foto: "", esgotado: false, acomp: ["Arroz", "Feijão", "Farofa", "Macarrão"], carnes: 2 },
    { id: "g",   nome: "Marmita G",         preco: 26, foto: "", esgotado: false, acomp: ["Arroz", "Feijão", "Farofa", "Macarrão"], carnes: 2 },
    { id: "sal", nome: "Salada",            preco: 8,  foto: "", esgotado: false, acomp: [], carnes: 0 }
  ]
};

// Fotos que já vêm com o site (ficam na mesma pasta do index.html).
const FOTOS_DO_SITE = { pf: "pf.jpg", eco: "Economica.jpg", p: "Marmita_P.jpg", m: "M.jpg", g: "G.jpg", sal: "Salada.jpg" };
PADRAO.produtos.forEach(p => p.foto = FOTOS_DO_SITE[p.id] || "");
// Produto sem foto, ou com a foto de exemplo antiga (Pexels), usa a foto do site
const fotoDe = p => (!p.foto || /pexels\.com/.test(p.foto)) ? (FOTOS_DO_SITE[p.id] || "Logo.png") : p.foto;

/* =====================================================
   2. FERRAMENTAS PEQUENAS (usadas no site todo)
   ===================================================== */

let dados;            // guarda tudo: logo, cardápio, carnes e produtos

const $ = id => document.getElementById(id);                                  // atalho para achar um elemento
const real = n => "R$ " + Number(n).toFixed(2).replace(".", ",");            // 24 vira "R$ 24,00"
const semAcento = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// Troca símbolos perigosos por texto seguro antes de colocar na tela
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Pega uma foto escolhida no celular ou PC, diminui o tamanho (para o site não ficar pesado)
// e devolve como texto, que pode ser guardado junto com os outros dados.
function lerFoto(arquivo, maximo, fundoBranco) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, maximo / Math.max(img.width, img.height));   // quanto diminuir
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      const pincel = c.getContext("2d");
      if (fundoBranco) { pincel.fillStyle = "#fff"; pincel.fillRect(0, 0, c.width, c.height); }   // pinta de branco por baixo
      pincel.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      // JPEG não guarda "fundo transparente" (vira preto). PNG, WebP, GIF e SVG guardam,
      // então, nesses casos, salvamos em WebP, que mantém a transparência.
      const transparente = !fundoBranco && /png|webp|gif|svg/.test(arquivo.type);
      ok(transparente ? c.toDataURL("image/webp", 0.85) : c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = erro;
    img.src = URL.createObjectURL(arquivo);
  });
}

// Lê o arquivo, entrega o resultado para "guardar", salva e atualiza o painel
async function trocarImagem(arquivo, maximo, guardar, fundoBranco) {
  if (!arquivo) return;
  try { guardar(await lerFoto(arquivo, maximo, fundoBranco)); salvar(); desenharDono(); }
  catch (e) { alert("Não consegui abrir essa imagem."); }
}


// Com a nuvem ligada, os dados vêm sempre do servidor (assim todo mundo vê a versão mais nova).
// Sem a nuvem: 1) mudanças deste aparelho, 2) arquivo dados.json, 3) dados iniciais.
async function carregar() {
  if (API) {
    try {
      const r = await fetch(BASE + "/dados", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (d.produtos) return d; }
    } catch (e) {}
  } else {
    try { const s = localStorage.getItem(CHAVE); if (s) return JSON.parse(s); } catch (e) {}
    try { const r = await fetch("dados.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
  }
  return JSON.parse(JSON.stringify(PADRAO));
}
