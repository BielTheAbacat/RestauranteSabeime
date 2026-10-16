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
const API = "";
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

// Fotos de EXEMPLO de um banco gratuito (Pexels). Troque pelas suas no painel do dono.
const PEXELS = "https://images.pexels.com/photos/";
const COMIDA = PEXELS + "20350168/pexels-photo-20350168/free-photo-of-meal-with-meat-on-plate.jpeg?auto=compress&cs=tinysrgb&w=700";
const FOTOS_EXEMPLO = {
  pf:  PEXELS + "3727208/pexels-photo-3727208.jpeg?auto=compress&cs=tinysrgb&w=700",
  eco: PEXELS + "20350162/pexels-photo-20350162/free-photo-of-meat-on-plate.jpeg?auto=compress&cs=tinysrgb&w=700",
  p: COMIDA, m: COMIDA, g: COMIDA,
  sal: PEXELS + "4198015/pexels-photo-4198015.jpeg?auto=compress&cs=tinysrgb&w=700"
};
PADRAO.produtos.forEach(p => p.foto = FOTOS_EXEMPLO[p.id] || "");

/* =====================================================
   2. FERRAMENTAS PEQUENAS (usadas no site todo)
   ===================================================== */

let dados;            // guarda tudo: logo, cardápio, carnes e produtos
let carrinho = [];    // guarda o pedido do cliente
let entrega = { tipo: "retirada", bairro: "", rua: "", numero: "", compl: "" };   // retirada ou entrega (e o endereço)
let nomeCliente = "", obsCliente = "";   // o que o cliente digitou no resumo

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

/* =====================================================
   3. GUARDAR E CARREGAR OS DADOS
   ===================================================== */

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

// Guarda a mudança (na nuvem ou neste aparelho) e atualiza o que o cliente vê.
function salvar() {
  if (API) { if (senha) enviarServidor(); }
  else {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { alert("Não coube! Use fotos menores ou menos fotos."); }
  }
  desenharCliente();
}

// Manda os dados para a nuvem. Espera um instante para juntar várias mudanças seguidas.
let espera;
function enviarServidor() {
  clearTimeout(espera);
  $("statusSalvo").textContent = "Salvando...";
  espera = setTimeout(async () => {
    try {
      const r = await fetch(BASE + "/dados", {
        method: "PUT",
        headers: { Authorization: "Bearer " + encodeURIComponent(senha), "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });
      $("statusSalvo").textContent = r.ok ? "Salvo para todos ✓" : "Não salvou. Entre de novo.";
      if (r.status === 401) { senha = ""; abrirAreaDono(); }
    } catch (e) { $("statusSalvo").textContent = "Sem internet: não salvou."; }
  }, 1200);
}

// Confere a senha com o servidor. Devolve:
// "ok" (certa), "senha" (errada), "config" (servidor sem senha), "endereco" (endereço da API errado) ou "rede" (sem conexão)
async function entrar(tentativa) {
  try {
    const r = await fetch(BASE + "/entrar", { headers: { Authorization: "Bearer " + encodeURIComponent(tentativa) } });
    if (r.ok) { senha = tentativa; return "ok"; }
    if (r.status === 401) return "senha";
    if (r.status === 500) return "config";
    return "endereco";
  } catch (e) { return "rede"; }
}

// Mensagem para cada tipo de problema
const AVISOS = {
  senha: "Senha incorreta.",
  config: "O servidor ainda não tem a senha. Confira o segredo SENHA_DONO no Worker e clique em Deploy.",
  endereco: "O endereço da API parece errado. Confira a linha API no script.js.",
  rede: "Não consegui falar com o servidor. Confira a internet e o endereço da API."
};

// Mostra o painel (ou a tela de senha, se a nuvem estiver ligada)
async function abrirAreaDono() {
  const liberado = !API || ((senha !== "" && await entrar(senha)) === "ok");
  $("areaDono").hidden = !liberado;
  $("login").hidden = liberado;
  $("blocoPublicar").hidden = !!API;     // com a nuvem, não precisa baixar o dados.json
}
$("btEntrar").onclick = async () => {
  const r = await entrar($("inSenha").value.trim());
  if (r === "ok") { $("inSenha").value = ""; $("erroLogin").textContent = ""; abrirAreaDono(); }
  else $("erroLogin").textContent = AVISOS[r];
};

/* =====================================================
   4. TELA DO CLIENTE
   ===================================================== */

function desenharCliente() {
  // Logo do topo: a enviada pelo dono ou a original (logo.jpg)
  $("logoHero").src = dados.logo || "logo.jpg";
  $("logoHero").classList.toggle("original", !dados.logo);   // bordas esfumaçadas só na logo original

  // Imagem do cardápio (só aparece se o dono enviou)
  $("blocoCardapio").hidden = !dados.cardapio;
  $("semCardapio").hidden = !!dados.cardapio;
  if (dados.cardapio) $("imgCardapio").src = dados.cardapio;

  // Aviso das carnes que acabaram
  const acabou = dados.carnes.filter(c => c.esgotado).map(c => c.nome);
  $("avisoEsgotado").hidden = !acabou.length;
  $("avisoEsgotado").textContent = "Hoje acabou: " + acabou.join(", ");

  // Cartões grandes: foto de fundo, nome e preço por cima.
  // Se a foto não abrir, mostra a logo no lugar (onerror).
  const cartao = p => `
    <article class="produto reveal ${p.esgotado ? "esgotado" : ""}">
      <img src="${esc(p.foto || "logo.jpg")}" alt="${esc(p.nome)}" loading="lazy" onerror="this.onerror=null;this.src='logo.jpg'">
      <div class="info">
        <strong>${esc(p.nome)}</strong>
        <span class="preco">${real(p.preco)}</span>
        <button data-id="${esc(p.id)}" ${p.esgotado ? "disabled" : ""}>
          ${p.esgotado ? "Esgotado" : (p.acomp.length || p.carnes ? "Montar" : "Adicionar")}
        </button>
      </div>
    </article>`;
  // Itens com preço zero ficam escondidos (provavelmente o dono ainda está preenchendo)
  const visiveis = dados.produtos.filter(p => p.preco > 0);
  const bebidas = visiveis.filter(p => p.categoria === "bebida");
  $("listaProdutos").innerHTML = visiveis.filter(p => p.categoria !== "bebida").map(cartao).join("");
  $("listaBebidas").innerHTML = bebidas.map(cartao).join("");
  $("bebidas").hidden = !bebidas.length;     // a seção só aparece se houver bebida

  // Link de avaliação do Google no rodapé (só aceita endereço que começa com https://)
  const linkAv = dados.avaliacao ?? AVALIACAO_PADRAO;     // se o dono nunca mexeu, usa o link padrão
  const temLink = /^https:\/\//.test(linkAv);
  $("linkAvaliacao").hidden = !temLink;
  if (temLink) $("linkAvaliacao").href = linkAv;
  ativarReveal();   // liga a animação de "aparecer" nos cartões novos
}

// Clique em "Montar" / "Adicionar" em qualquer produto
$("telaCliente").addEventListener("click", e => {
  const bt = e.target.closest("button[data-id]");
  if (bt) abrirItem(bt.dataset.id);
});

// Janela para o cliente tirar acompanhamentos e escolher a(s) carne(s)
function abrirItem(id) {
  const p = dados.produtos.find(x => String(x.id) === String(id));
  if (!p.acomp.length && !p.carnes) return addCarrinho(p, [], []);   // produto simples entra direto

  const d = $("dlgItem");
  d.innerHTML = `
    <h3>${esc(p.nome)} — ${real(p.preco)}</h3>
    ${p.acomp.length ? `<h4>Vem no prato (desmarque o que NÃO quer)</h4>` +
      p.acomp.map(a => `<label><input type="checkbox" class="ac" value="${esc(a)}" checked>${esc(a)}</label>`).join("") : ""}
    ${p.carnes ? `<h4>Escolha a carne (${p.carnes === 1 ? "só uma" : "até " + p.carnes})</h4>` +
      (dados.carnes.length ? dados.carnes.map(c => `<label><input type="checkbox" class="ca" value="${esc(c.nome)}" ${c.esgotado ? "disabled" : ""}>${esc(c.nome)}${c.esgotado ? " (esgotado)" : ""}</label>`).join("")
        : `<p class="dica">Nenhuma carne cadastrada hoje.</p>`) : ""}
    <p id="erroItem" class="erro"></p>
    <div class="linha"><button class="sec" id="cancelaItem">Cancelar</button><button id="okItem">Adicionar</button></div>`;
  d.showModal();

  // Controla o limite de carnes: com limite 1 troca a escolha; com limite 2 impede a terceira
  d.querySelectorAll(".ca").forEach(cb => cb.onchange = () => {
    const marcadas = [...d.querySelectorAll(".ca:checked")];
    if (marcadas.length <= p.carnes) return;
    if (p.carnes === 1) marcadas.filter(m => m !== cb).forEach(m => m.checked = false);
    else { cb.checked = false; $("erroItem").textContent = `Máximo de ${p.carnes} carnes.`; }
  });

  $("cancelaItem").onclick = () => d.close();
  $("okItem").onclick = () => {
    const carnes = [...d.querySelectorAll(".ca:checked")].map(c => c.value);
    const sem = [...d.querySelectorAll(".ac:not(:checked)")].map(c => c.value);   // o que o cliente tirou
    if (p.carnes && !carnes.length) { $("erroItem").textContent = "Escolha pelo menos uma carne."; return; }
    addCarrinho(p, sem, carnes);
    d.close();
  };
}

// Coloca no pedido. Se já existe o mesmo prato igualzinho, só aumenta a quantidade.
function addCarrinho(p, sem, carnes) {
  const chave = [p.id, sem.join(), carnes.join()].join("|");
  const igual = carrinho.find(i => i.chave === chave);
  if (igual) igual.qtd++;
  else carrinho.push({ chave, nome: p.nome, preco: p.preco, sem, carnes, qtd: 1 });
  desenharBarra();
}

const total = () => carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);

// Barra fixa embaixo com o total
function desenharBarra() {
  const b = $("barraPedido");
  b.hidden = !carrinho.length;
  b.textContent = `Finalizar pedido • ${carrinho.reduce((s, i) => s + i.qtd, 0)} item(ns) • ${real(total())}`;
}
$("barraPedido").onclick = abrirResumo;

// Janela de resumo: mostra o pedido, o total e o botão de confirmar
function abrirResumo() {
  const d = $("dlgResumo");
  if (!carrinho.length) return d.close();
  d.innerHTML = `
    <h3>Seu pedido</h3>
    ${carrinho.map((i, n) => `
      <div class="item">
        <span><strong>${esc(i.nome)}</strong>${i.carnes.length ? `<br>Carnes: ${esc(i.carnes.join(", "))}` : ""}${i.sem.length ? `<br>Sem: ${esc(i.sem.join(", "))}` : ""}</span>
        <span class="qtd"><button data-n="${n}" data-d="-1">−</button> ${i.qtd} <button data-n="${n}" data-d="1">+</button></span>
        <span class="preco">${real(i.preco * i.qtd)}</span>
      </div>`).join("")}
    <label>Seu nome <input id="inNome" value="${esc(nomeCliente)}"></label>
    <h4>Como você quer receber?</h4>
    <div class="opcoes">
      <label class="opcao"><input type="radio" name="tipo" value="retirada" ${entrega.tipo === "retirada" ? "checked" : ""}>Retirar no local</label>
      <label class="opcao"><input type="radio" name="tipo" value="entrega" ${entrega.tipo === "entrega" ? "checked" : ""}>Entrega</label>
    </div>
    <div id="blocoEntrega" ${entrega.tipo === "entrega" ? "" : "hidden"}>
      <label>Bairro <input id="inBairro" value="${esc(entrega.bairro)}"></label>
      <label>Rua <input id="inRua" value="${esc(entrega.rua)}"></label>
      <label>Número <input id="inNumero" value="${esc(entrega.numero)}"></label>
      <label>Complemento (opcional) <input id="inCompl" placeholder="Ex.: nos fundos, perto da padaria" value="${esc(entrega.compl)}"></label>
    </div>
    <label>Observação (opcional) <textarea id="inObs" rows="2">${esc(obsCliente)}</textarea></label>
    <p class="total">Total: ${real(total())}</p>
    <p id="erroResumo" class="erro"></p>
    <div class="linha"><button class="sec" id="voltar">Voltar</button><button id="confirmar">Confirmar no WhatsApp</button></div>`;
  if (!d.open) d.showModal();

  $("inNome").oninput = e => nomeCliente = e.target.value;
  $("inObs").oninput = e => obsCliente = e.target.value;
  // Retirada ou entrega: os campos de endereço só aparecem quando for entrega
  d.querySelectorAll('input[name="tipo"]').forEach(r => r.onchange = () => {
    entrega.tipo = r.value;
    $("blocoEntrega").hidden = r.value !== "entrega";
  });
  [["inBairro", "bairro"], ["inRua", "rua"], ["inNumero", "numero"], ["inCompl", "compl"]]
    .forEach(([id, campo]) => $(id).oninput = e => entrega[campo] = e.target.value);
  $("voltar").onclick = () => d.close();
  // Botões − e +
  d.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
    const i = carrinho[b.dataset.n];
    i.qtd += Number(b.dataset.d);
    if (i.qtd <= 0) carrinho.splice(b.dataset.n, 1);
    desenharBarra();
    abrirResumo();
  });
  $("confirmar").onclick = enviarWhats;
}

// Monta a mensagem e abre o WhatsApp já com o pedido escrito
function enviarWhats() {
  if (!nomeCliente.trim()) { $("erroResumo").textContent = "Digite seu nome para continuar."; return; }
  if (entrega.tipo === "entrega" && !(entrega.bairro.trim() && entrega.rua.trim() && entrega.numero.trim())) {
    $("erroResumo").textContent = "Para entrega, preencha bairro, rua e número.";
    return;
  }
  const linhas = carrinho.map(i =>
    `${i.qtd}x ${i.nome} (${real(i.preco * i.qtd)})` +
    (i.carnes.length ? `\n   Carnes: ${i.carnes.join(", ")}` : "") +
    (i.sem.length ? `\n   Sem: ${i.sem.join(", ")}` : ""));
  // Texto de retirada ou entrega que vai na mensagem
  const textoEntrega = entrega.tipo === "entrega"
    ? `*ENTREGA*\nBairro: ${entrega.bairro.trim()}\nRua: ${entrega.rua.trim()}, nº ${entrega.numero.trim()}` +
      (entrega.compl.trim() ? `\nComplemento: ${entrega.compl.trim()}` : "")
    : "*RETIRADA NO LOCAL*";
  const msg = `*Pedido - Restaurante Sabeime*\nCliente: ${nomeCliente.trim()}\n${textoEntrega}\n\n${linhas.join("\n")}\n` +
    (obsCliente.trim() ? `\nObs: ${obsCliente.trim()}\n` : "") + `\n*Total: ${real(total())}*`;
  window.open(`https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* =====================================================
   5. PAINEL DO DONO
   ===================================================== */

// Desenha tudo do painel com os dados atuais
function desenharDono() {
  $("prevLogo").src = dados.logo || "logo.jpg";
  $("inAvaliacao").value = dados.avaliacao ?? AVALIACAO_PADRAO;
  $("prevCardapio").hidden = !dados.cardapio;
  if (dados.cardapio) $("prevCardapio").src = dados.cardapio;

  // Lista de carnes com botão de esgotar e remover
  $("listaCarnes").innerHTML = dados.carnes.map((c, i) => `
    <div class="item"><span>${esc(c.nome)}</span>
      <label><input type="checkbox" data-esg="${i}" ${c.esgotado ? "checked" : ""}>Esgotado</label>
      <button class="perigo" data-delc="${i}">Remover</button></div>`).join("") || `<p class="dica">Nenhuma carne ainda.</p>`;

  // Um formulário para cada produto
  $("listaForm").innerHTML = dados.produtos.map((p, i) => `
    <div class="cartao" data-i="${i}">
      <label>Nome <input data-c="nome" value="${esc(p.nome)}"></label>
      <label>Tipo <select data-c="categoria"><option value="prato" ${p.categoria !== "bebida" ? "selected" : ""}>Prato</option><option value="bebida" ${p.categoria === "bebida" ? "selected" : ""}>Bebida</option></select></label>
      <label>Preço (R$) <input data-c="preco" type="number" step="0.5" min="0" value="${p.preco}"></label>
      <div class="foto"><img src="${esc(p.foto || "logo.jpg")}" alt="">
        <label class="botaoArq">Trocar foto <input type="file" accept="image/*" data-foto="${i}" hidden></label></div>
      <label>O que vem no prato, separado por vírgula (o cliente pode tirar) <input data-c="acomp" value="${esc(p.acomp.join(", "))}"></label>
      <label>Quantas carnes o cliente escolhe
        <select data-c="carnes">${[0, 1, 2].map(n => `<option value="${n}" ${p.carnes === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <div class="item"><label><input type="checkbox" data-c="esgotado" ${p.esgotado ? "checked" : ""}>Esgotado</label>
        <button class="perigo" data-delp="${i}">Excluir produto</button></div>
    </div>`).join("");
}

// Salvar logo
// Logo: enviar do aparelho, ou voltar à original
$("inLogoArq").onchange = e => trocarImagem(e.target.files[0], 900, d => dados.logo = d);
$("btLogoPadrao").onclick = () => { dados.logo = ""; salvar(); desenharDono(); };
// Foto de um produto: enviar do aparelho
$("listaForm").addEventListener("change", e => {
  const i = e.target.dataset.foto;
  if (i !== undefined) trocarImagem(e.target.files[0], 800, d => dados.produtos[i].foto = d);
});

// Mudanças nos formulários dos produtos (salva sozinho quando o campo é alterado)
$("listaForm").addEventListener("change", e => {
  const campo = e.target.dataset.c, i = e.target.closest(".cartao")?.dataset.i;
  if (!campo) return;
  const p = dados.produtos[i];
  if (campo === "preco") p.preco = Number(e.target.value) || 0;
  else if (campo === "carnes") p.carnes = Number(e.target.value);
  else if (campo === "esgotado") p.esgotado = e.target.checked;
  else if (campo === "acomp") p.acomp = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
  else p[campo] = e.target.value.trim();
  salvar();
});
// Excluir produto
$("listaForm").addEventListener("click", e => {
  const i = e.target.dataset.delp;
  if (i !== undefined && confirm("Excluir este produto?")) { dados.produtos.splice(i, 1); salvar(); desenharDono(); }
});
// Novo prato ou nova bebida
function novoProduto(categoria) {
  dados.produtos.push({ id: String(Date.now()), nome: categoria === "bebida" ? "Nova bebida" : "Novo prato", preco: 0, foto: "", esgotado: false, acomp: [], carnes: 0, categoria });
  salvar(); desenharDono();
}
$("btNovoProd").onclick = () => novoProduto("prato");
$("btNovaBebida").onclick = () => novoProduto("bebida");

// Link de avaliação do Google
$("btAvaliacao").onclick = () => {
  const link = $("inAvaliacao").value.trim();
  if (link && !/^https:\/\//.test(link)) { alert("O link precisa começar com https://"); return; }
  dados.avaliacao = link;
  salvar();
};

// Carnes: marcar esgotado, remover e adicionar
$("listaCarnes").addEventListener("click", e => {
  if (e.target.dataset.delc !== undefined) { dados.carnes.splice(e.target.dataset.delc, 1); salvar(); desenharDono(); }
});
$("listaCarnes").addEventListener("change", e => {
  if (e.target.dataset.esg !== undefined) { dados.carnes[e.target.dataset.esg].esgotado = e.target.checked; salvar(); }
});
$("btNovaCarne").onclick = () => {
  const nome = $("novaCarne").value.trim();
  if (nome) { dados.carnes.push({ nome, esgotado: false }); $("novaCarne").value = ""; salvar(); desenharDono(); }
};

/* ---------- Leitura do cardápio (transforma a imagem em texto) ---------- */

// Palavras que NÃO são carne (o que vem no prato ou títulos). Linhas com elas são ignoradas.
const NAO_CARNE = ["arroz", "feij", "macarr", "farofa", "salada", "cardapio", "prato", "feito", "marmita", "hoje", "preco", "r$"];

// Pega o texto lido da foto e separa só as carnes
function extrairCarnes(texto) {
  const partes = texto.split(/[\n,;+•|\/]|\s-\s|\se\s/i);   // corta em vírgulas, quebras de linha e no "e"
  const vistos = new Set(), lista = [];
  partes.forEach(p => {
    p = p.replace(/[^A-Za-zÀ-ÿ ]/g, " ").replace(/\s+/g, " ").trim();   // tira números e símbolos
    const k = semAcento(p);
    if (p.length < 4 || vistos.has(k) || NAO_CARNE.some(w => k.includes(w))) return;
    vistos.add(k);
    lista.push(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  });
  return lista;
}

// Baixa o leitor de imagens só quando for usar (o site do cliente continua leve)
function carregarLeitor() {
  return new Promise((ok, erro) => {
    if (window.Tesseract) return ok();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.onload = ok; s.onerror = erro;
    document.head.appendChild(s);
  });
}

// Lê a imagem (link ou arquivo do aparelho) e mostra as carnes para o dono conferir
async function lerCardapio(origem) {
  $("statusLeitura").textContent = "Lendo a imagem... pode demorar um pouco.";
  $("blocoPrevia").hidden = false;
  try {
    await carregarLeitor();
    const r = await Tesseract.recognize(origem, "por");
    const carnes = extrairCarnes(r.data.text);
    $("previaCarnes").value = carnes.join("\n");
    $("statusLeitura").textContent = carnes.length ? "Confira as carnes abaixo e clique em “Usar estas carnes”." : "Não achei carnes. Digite uma por linha abaixo.";
  } catch (e) {
    $("statusLeitura").textContent = "Não consegui ler a imagem. Digite as carnes, uma por linha, abaixo.";
  }
}
// Cardápio: enviar a foto e já tentar ler as carnes
$("inCardapioArq").onchange = e => trocarImagem(e.target.files[0], 1800, d => { dados.cardapio = d; lerCardapio(d); }, true);

// Aceita as carnes conferidas (mantém "esgotado" de quem já existia)
$("btUsar").onclick = () => {
  const antigas = dados.carnes;
  dados.carnes = $("previaCarnes").value.split("\n").map(s => s.trim()).filter(Boolean)
    .map(nome => ({ nome, esgotado: antigas.some(c => semAcento(c.nome) === semAcento(nome) && c.esgotado) }));
  $("blocoPrevia").hidden = true; $("statusLeitura").textContent = "Carnes atualizadas!";
  salvar(); desenharDono();
};

// Publicar: baixa o arquivo dados.json para colocar na pasta do site
$("btBaixar").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
  a.download = "dados.json";
  a.click();
};
// Descartar: apaga as mudanças deste aparelho e volta ao que está publicado
$("btLimpar").onclick = () => {
  if (confirm("Apagar as mudanças deste aparelho?")) { try { localStorage.removeItem(CHAVE); } catch (e) {} location.reload(); }
};

/* =====================================================
   6. QUAL TELA MOSTRAR E COMEÇO DO SITE
   ===================================================== */

// Se o endereço termina com #dono, mostra o painel; senão, o site normal.
function rota() {
  const dono = /^#\/?dono/.test(location.hash);
  $("telaCliente").hidden = dono;
  $("telaDono").hidden = !dono;
  if (dono) { desenharDono(); abrirAreaDono(); }
}
window.addEventListener("hashchange", rota);

// Começa: carrega os dados e desenha a tela
(async () => {
  dados = await carregar();
  desenharCliente();
  rota();
})();

/* =====================================================
   7. ANIMAÇÕES (movimento ao rolar a página)
   ===================================================== */

document.body.classList.add("com-js");   // avisa o visual que o JavaScript está ligado

// "Vigia" que percebe quando um elemento entra na tela e liga a animação de aparecer
const vigia = "IntersectionObserver" in window ? new IntersectionObserver(lista => {
  lista.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visivel"); vigia.unobserve(e.target); } });
}, { threshold: 0.12 }) : null;

function ativarReveal() {
  document.querySelectorAll(".reveal:not(.visivel)").forEach((el, n) => {
    if (!vigia) return el.classList.add("visivel");     // navegador antigo: mostra tudo direto
    el.style.transitionDelay = (n % 4) * 90 + "ms";      // cartões entram um depois do outro
    vigia.observe(el);
  });
}

// Ao rolar: o menu ganha fundo e a logo se move mais devagar que a página
let esperando = false;
addEventListener("scroll", () => {
  if (esperando) return;
  esperando = true;
  requestAnimationFrame(() => {
    $("menu").classList.toggle("solido", scrollY > 60);
    document.documentElement.style.setProperty("--py", scrollY);
    esperando = false;
  });
}, { passive: true });
