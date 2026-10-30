/* =====================================================
   WORKER DO PIX (Mercado Pago)  —  é um Worker NOVO, separado do
   Worker do cardápio (que continua como está, sem mudar nada).

   Ele existe para guardar com segurança o Access Token do Mercado
   Pago. Esse código NUNCA pode ficar no site (script.js), porque
   qualquer pessoa consegue ler os arquivos do site.

   O que ele faz:
   - /pix/criar  -> confere o pedido, calcula o valor com os preços
                    que estão guardados no cardápio (o cliente não
                    consegue mudar o preço) e pede o Pix ao Mercado Pago;
   - /pix/status -> diz se o Pix já foi pago ("approved" = pago).

   PASSO A PASSO (no computador, com o Node instalado):
   1. Entre em mercadopago.com.br/developers, crie uma "aplicação"
      (tipo Checkout Transparente / API de Pagamentos) e copie o
      ACCESS TOKEN. Comece pelas credenciais de TESTE; depois troque
      pelas de produção (as que começam com APP_USR-).
   2. No wrangler.toml, cole o ID do armazenamento (KV) do cardápio e
      um e-mail seu em EMAIL_PAGADOR (o Mercado Pago exige um e-mail
      em todo Pix; use um e-mail DIFERENTE do e-mail da conta dele).
   3. Guarde o Access Token como segredo (ele pergunta e você cola):
        npx wrangler secret put MP_ACCESS_TOKEN
   4. Publique:  npx wrangler deploy
   5. Cole o endereço do Worker novo em API_PIX, no começo do script.js.
   ===================================================== */

const MERCADO_PAGO = "https://api.mercadopago.com";
const MINUTOS = 30;   // por quanto tempo o Pix vale

export default {
  async fetch(pedido, env) {
    const url = new URL(pedido.url);
    const permissoes = {
      "Access-Control-Allow-Origin": env.SITE_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };
    const responder = (objeto, status = 200) => new Response(JSON.stringify(objeto), {
      status, headers: { ...permissoes, "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
    if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: permissoes });

    try {
      if (url.pathname === "/pix/criar" && pedido.method === "POST") return await criar(pedido, env, responder);
      if (url.pathname === "/pix/status" && pedido.method === "GET") return await status(url, env, responder);
    } catch (e) {
      console.log("erro no pix:", e.message);   // nunca escreve o token no registro
      return responder({ erro: "Não foi possível falar com o Mercado Pago." }, 502);
    }
    return responder({ erro: "Não encontrado." }, 404);
  }
};

// Faz uma chamada ao Mercado Pago já com o token
async function mp(env, metodo, caminho, corpo) {
  const cabecalhos = { Authorization: "Bearer " + env.MP_ACCESS_TOKEN, "Content-Type": "application/json" };
  if (metodo === "POST") cabecalhos["X-Idempotency-Key"] = crypto.randomUUID();   // o Mercado Pago exige em todo pedido de criação
  const r = await fetch(MERCADO_PAGO + caminho, { method: metodo, headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await r.text();
  if (!r.ok) { console.log("mercado pago respondeu", r.status, texto.slice(0, 300)); throw new Error("mp " + r.status); }
  return JSON.parse(texto);
}

const aleatorio = bytes => [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, "0")).join("");

// Cria a cobrança Pix do pedido
async function criar(pedido, env, responder) {
  const { itens } = await pedido.json();
  if (!Array.isArray(itens) || !itens.length || itens.length > 40) return responder({ erro: "Pedido vazio." }, 400);

  // O valor sai dos preços guardados no cardápio, nunca do que o navegador mandou
  const dados = JSON.parse((await env.SABEIME.get("dados")) || "{}");
  let centavos = 0;
  for (const it of itens) {
    const p = (dados.produtos || []).find(x => x.id === it.id);
    const qtd = Number(it.qtd);
    if (!p || p.esgotado || !(p.preco > 0) || !Number.isInteger(qtd) || qtd < 1 || qtd > 50)
      return responder({ erro: "Item inválido. Atualize a página e tente de novo." }, 400);
    centavos += Math.round(p.preco * 100) * qtd;
  }
  if (centavos < 1 || centavos > 1000000) return responder({ erro: "Valor inválido." }, 400);

  const ref = aleatorio(16);   // código secreto deste pedido: só quem criou o Pix consegue consultar
  // Hora de vencimento no horário de Brasília (-03:00)
  const vence = new Date(Date.now() + MINUTOS * 60000 - 3 * 3600000).toISOString().replace("Z", "-03:00");
  const pg = await mp(env, "POST", "/v1/payments", {
    transaction_amount: Number((centavos / 100).toFixed(2)),
    description: "Pedido " + (env.NOME_LOJA || "Restaurante Sabeime"),
    payment_method_id: "pix",
    external_reference: ref,
    date_of_expiration: vence,
    payer: { email: env.EMAIL_PAGADOR }
  });
  const dado = pg.point_of_interaction && pg.point_of_interaction.transaction_data;
  if (!dado || !dado.qr_code) throw new Error("mercado pago sem qr code");
  return responder({ id: pg.id, ref, valor: centavos / 100, copiaECola: dado.qr_code, qrBase64: dado.qr_code_base64, expiraEm: MINUTOS * 60 });
}

// Pergunta se o Pix já foi pago ("approved" = pago)
async function status(url, env, responder) {
  const id = url.searchParams.get("id") || "", ref = url.searchParams.get("ref") || "";
  if (!/^\d{5,20}$/.test(id) || !/^[a-f0-9]{32}$/.test(ref)) return responder({ erro: "Código inválido." }, 400);
  const pg = await mp(env, "GET", "/v1/payments/" + id);
  if (pg.external_reference !== ref) return responder({ erro: "Pagamento não encontrado." }, 404);
  return responder({ status: pg.status });
}
