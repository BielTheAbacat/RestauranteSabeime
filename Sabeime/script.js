/* =====================================================
   SCRIPT.JS: o site que o cliente vê (cardápio, pedido e Pix)
   As configurações ficam no comum.js. O painel do dono fica
   em outro arquivo (painel.html), que não aparece neste site.
   ===================================================== */

// Endereço do Worker do Pix (veja worker-pix.js). Deixe vazio ("") para o Pix continuar só combinado no WhatsApp.
const API_PIX = "";

// O que o cliente está montando
let carrinho = [];    // guarda o pedido do cliente
let entrega = { tipo: "retirada", bairro: "", rua: "", numero: "", compl: "" };   // retirada ou entrega (e o endereço)
let nomeCliente = "", obsCliente = "", pagamento = "";   // o que o cliente digitou no resumo

/* =====================================================
   4. TELA DO CLIENTE
   ===================================================== */

function desenharCliente() {
  // Logo do topo: a enviada pelo dono ou a original (Logo.png)
  $("logoHero").src = dados.logo || "Logo.png";
  $("logoMenu").src = $("logoHero").src;

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
    <article class="prato reveal ${p.esgotado ? "esgotado" : ""}">
      <div class="prato-foto"><img src="${esc(fotoDe(p))}" alt="${esc(p.nome)}" loading="lazy" onerror="this.onerror=null;this.src='Logo.png'"></div>
      <div class="prato-texto"><strong>${esc(p.nome)}</strong>
        <span class="detalhe">${[p.acomp.length ? "Vem com " + p.acomp.join(", ").toLowerCase() : "", p.carnes ? (p.carnes === 1 ? "1 carne" : "até " + p.carnes + " carnes") + " à sua escolha" : ""].filter(Boolean).join(" · ")}</span>
        <span class="preco">${real(p.preco)}</span></div>
      ${p.esgotado ? `<span class="etiqueta">Esgotado</span>` : `<button class="mais" data-id="${esc(p.id)}" aria-label="Adicionar ${esc(p.nome)}">+</button>`}
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
  else carrinho.push({ chave, id: p.id, nome: p.nome, preco: p.preco, sem, carnes, qtd: 1 });
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

// Formas de pagamento: na entrega só Pix e dinheiro; na retirada, todas.
function desenharPagamento() {
  const formas = entrega.tipo === "entrega" ? ["Pix", "Dinheiro"] : ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito"];
  if (!formas.includes(pagamento)) pagamento = "";   // se a forma escolhida saiu da lista, o cliente escolhe de novo
  $("opcoesPag").innerHTML = formas.map(f => `<label class="opcao"><input type="radio" name="pag" value="${f}" ${pagamento === f ? "checked" : ""}>${f}</label>`).join("");
  $("notaPag").textContent = entrega.tipo === "entrega" ? "Na entrega, aceitamos Pix e dinheiro." : "";
  const ajustar = () => $("confirmar").textContent = pagamento === "Pix" && API_PIX ? "Confirmar e pagar com Pix" : "Confirmar no WhatsApp";
  ajustar();
  $("dlgResumo").querySelectorAll('input[name="pag"]').forEach(r => r.onchange = () => { pagamento = r.value; ajustar(); });
}

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
    <h4>Forma de pagamento</h4>
    <div class="opcoes" id="opcoesPag"></div>
    <p id="notaPag" class="dica"></p>
    <label>Observação (opcional) <textarea id="inObs" rows="2">${esc(obsCliente)}</textarea></label>
    <p class="total">Total: ${real(total())}</p>
    <p id="erroResumo" class="erro"></p>
    <p class="dica">Ao enviar, você concorda com a <a href="#privacidade">Política de Privacidade</a> e com os <a href="#termos">Termos de Uso</a>.</p>
    <div class="linha"><button class="sec" id="voltar">Voltar</button><button id="confirmar">Confirmar no WhatsApp</button></div>`;
  if (!d.open) d.showModal();

  $("inNome").oninput = e => nomeCliente = e.target.value;
  $("inObs").oninput = e => obsCliente = e.target.value;
  // Retirada ou entrega: os campos de endereço só aparecem quando for entrega
  d.querySelectorAll('input[name="tipo"]').forEach(r => r.onchange = () => {
    entrega.tipo = r.value;
    $("blocoEntrega").hidden = r.value !== "entrega";
    desenharPagamento();
  });
  [["inBairro", "bairro"], ["inRua", "rua"], ["inNumero", "numero"], ["inCompl", "compl"]]
    .forEach(([id, campo]) => $(id).oninput = e => entrega[campo] = e.target.value);
  desenharPagamento();
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
  if (entrega.tipo === "entrega" && /^Cartão/.test(pagamento)) pagamento = "";
  if (!pagamento) { $("erroResumo").textContent = "Escolha a forma de pagamento."; return; }
  if (pagamento === "Pix" && API_PIX) return pagarPix();   // Pix: primeiro paga, depois manda o pedido
  abrirWhats(montarMensagem());
}

const abrirWhats = msg => window.open(`https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`, "_blank");

// Monta o texto do pedido (extra = um complemento na linha do pagamento, como "Pix pago")
function montarMensagem(extra = "") {
  const linhas = carrinho.map(i =>
    `${i.qtd}x ${i.nome} (${real(i.preco * i.qtd)})` +
    (i.carnes.length ? `\n   Carnes: ${i.carnes.join(", ")}` : "") +
    (i.sem.length ? `\n   Sem: ${i.sem.join(", ")}` : ""));
  // Texto de retirada ou entrega que vai na mensagem
  const textoEntrega = entrega.tipo === "entrega"
    ? `*ENTREGA*\nBairro: ${entrega.bairro.trim()}\nRua: ${entrega.rua.trim()}, nº ${entrega.numero.trim()}` +
      (entrega.compl.trim() ? `\nComplemento: ${entrega.compl.trim()}` : "")
    : "*RETIRADA NO LOCAL*";
  const msg = `*Pedido - Restaurante Sabeime*\nCliente: ${nomeCliente.trim()}\n${textoEntrega}\nPagamento: ${pagamento}${extra}\n\n${linhas.join("\n")}\n` +
    (obsCliente.trim() ? `\nObs: ${obsCliente.trim()}\n` : "") + `\n*Total: ${real(total())}*`;
  return msg;
}

/* =====================================================
   PIX (Mercado Pago): gera a cobrança, mostra o QR code e o
   "copia e cola", e espera o pagamento ser confirmado.
   ===================================================== */
let timerPix = null;
const pararPix = () => { clearInterval(timerPix); timerPix = null; };
$("dlgResumo").addEventListener("close", pararPix);   // fechou a janela: para de perguntar ao Worker
const urlPix = caminho => API_PIX.trim().replace(/\/+$/, "") + caminho;

async function pagarPix() {
  const bt = $("confirmar");
  bt.disabled = true; bt.textContent = "Gerando o Pix…"; $("erroResumo").textContent = "";
  try {
    const r = await fetch(urlPix("/pix/criar"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: carrinho.map(i => ({ id: i.id, qtd: i.qtd })) })
    });
    const cob = await r.json();
    if (!r.ok || !cob.copiaECola) throw new Error(cob.erro || "falhou");
    mostrarPix(cob);
  } catch (e) {
    bt.disabled = false; bt.textContent = "Confirmar e pagar com Pix";
    $("erroResumo").textContent = "Não consegui gerar o Pix agora. Tente de novo ou escolha outra forma de pagamento.";
  }
}

function mostrarPix(cob) {
  const d = $("dlgResumo");
  const msgPago = montarMensagem(` (Pix pago, nº ${cob.id})`);     // fica pronta antes de limpar o pedido
  const msgAviso = montarMensagem(` (Pix: cliente diz que pagou, conferir. Nº ${cob.id})`);
  d.innerHTML = `
    <h3>Pague com Pix</h3>
    <p class="dica">Valor: <strong>${real(cob.valor)}</strong>. Escaneie o QR code no app do seu banco ou use o Pix copia e cola. O código vale por 30 minutos.</p>
    <div class="qr">${cob.qrBase64 ? `<img alt="QR code do Pix" src="data:image/png;base64,${esc(cob.qrBase64)}">` : ""}</div>
    <label>Pix copia e cola <textarea id="codigoPix" rows="3" readonly>${esc(cob.copiaECola)}</textarea></label>
    <button id="copiarPix">Copiar código Pix</button>
    <p id="statusPix" class="dica" role="status">Aguardando o pagamento…</p>
    <div class="linha"><button class="sec" id="fecharPix">Cancelar</button><button class="sec" id="jaPaguei">Já paguei e não confirmou</button></div>`;
  $("copiarPix").onclick = async () => {
    try { await navigator.clipboard.writeText(cob.copiaECola); }
    catch (e) { $("codigoPix").select(); document.execCommand("copy"); }
    $("copiarPix").textContent = "Código copiado ✓";
  };
  $("fecharPix").onclick = () => d.close();
  $("jaPaguei").onclick = () => abrirWhats(msgAviso);   // plano B: avisa o restaurante, que confere no Mercado Pago

  pararPix();
  const fim = Date.now() + (cob.expiraEm || 1800) * 1000;
  timerPix = setInterval(async () => {
    if (Date.now() > fim) { pararPix(); $("statusPix").textContent = "O tempo deste Pix acabou. Feche e faça o pedido de novo."; return; }
    try {
      const s = await (await fetch(urlPix(`/pix/status?id=${encodeURIComponent(cob.id)}&ref=${encodeURIComponent(cob.ref)}`))).json();
      if (s.status === "approved") { pararPix(); pagoPix(cob, msgPago); }                       // approved = pago
      else if (s.status && !["pending", "in_process", "authorized"].includes(s.status)) { pararPix(); $("statusPix").textContent = "Este Pix foi cancelado ou venceu. Feche e faça o pedido de novo."; }
    } catch (e) { /* sem internet agora: tenta de novo daqui a pouco */ }
  }, 4000);
}

// Pix pago: limpa o pedido e deixa só o botão que manda tudo para o WhatsApp
function pagoPix(cob, msg) {
  carrinho.length = 0; desenharBarra();
  $("dlgResumo").innerHTML = `
    <h3>Pagamento confirmado ✓</h3>
    <p>Recebemos seu Pix de <strong>${real(cob.valor)}</strong>. Falta só um passo: enviar o pedido para o nosso WhatsApp.</p>
    <div class="linha"><button id="enviarPago">Enviar pedido no WhatsApp</button></div>`;
  $("enviarPago").onclick = () => abrirWhats(msg);
}

/* =====================================================
   6. QUAL TELA MOSTRAR E COMEÇO DO SITE
   ===================================================== */

// Qual tela mostrar: #privacidade / #termos = textos legais, o resto = site.
let telaAtual = "";
function rota() {
  const h = location.hash.replace(/^#\/?/, "");
  const tela = (h === "privacidade" || h === "termos") ? "legal" : "site";
  const mostrar = () => {
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    $("telaCliente").hidden = tela !== "site";
    $("telaLegal").hidden = tela !== "legal";
    if (tela === "legal") desenharLegal(h);
    if (tela !== "legal") document.title = "Restaurante Sabeime | Comida caseira";
    if (tela !== telaAtual) {   // veio de outra tela: volta ao topo (ou vai até a parte pedida)
      const alvo = tela === "site" && h && document.getElementById(h);
      alvo ? alvo.scrollIntoView({ behavior: "instant" }) : scrollTo({ top: 0, behavior: "instant" });
    }
    telaAtual = tela;
  };
  const suave = telaAtual && tela !== telaAtual && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  suave ? document.startViewTransition(mostrar) : mostrar();
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
