/* =====================================================
   PAINEL.JS: tudo do painel do dono (usado só no painel.html)
   ===================================================== */

/* =====================================================
   SALVAR E ENTRAR COM A SENHA
   ===================================================== */


// Guarda a mudança (na nuvem ou neste aparelho) e atualiza o que o cliente vê.
function salvar() {
  if (API) { if (senha) enviarServidor(); }
  else {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { alert("Não coube! Use fotos menores ou menos fotos."); }
  }
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
  endereco: "O endereço da API parece errado. Confira a linha API no comum.js.",
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
   5. PAINEL DO DONO
   ===================================================== */

// Desenha tudo do painel com os dados atuais
function desenharDono() {
  $("prevLogo").src = dados.logo || "Logo.png";
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
      <div class="foto"><img src="${esc(fotoDe(p))}" alt="">
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
   COMEÇO DO PAINEL
   ===================================================== */
(async () => {
  dados = await carregar();
  desenharDono();
  abrirAreaDono();
})();
