/* =====================================================
   WORKER DO SABEIME
   Fica na nuvem da Cloudflare. Faz duas coisas:
   - entrega os dados do restaurante para qualquer cliente que abrir o site;
   - guarda os dados novos, mas só se vier a senha certa do dono.
   Precisa de 2 coisas ligadas nele (veja o passo a passo):
   - um armazenamento KV com o nome de variável  SABEIME
   - um segredo (Secret) chamado  SENHA_DONO  (a senha que você escolher)
   ===================================================== */

export default {
  async fetch(pedido, env) {
    const endereco = new URL(pedido.url);

    // Permissões para o site (que está em outro endereço) conversar com este Worker
    const permissoes = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    };
    // Atalho para montar uma resposta já com as permissões
    const responder = (texto, status = 200, extra = {}) =>
      new Response(texto, { status, headers: { ...permissoes, ...extra } });
    const json = { "Content-Type": "application/json", "Cache-Control": "no-cache" };

    // O navegador "pergunta antes" se pode enviar; respondemos que sim
    if (pedido.method === "OPTIONS") return responder(null, 204);

    // A senha veio certa? (se o segredo SENHA_DONO não existir, ninguém entra)
    const senhaCerta = !!env.SENHA_DONO && pedido.headers.get("Authorization") === "Bearer " + env.SENHA_DONO;

    // /entrar -> o painel usa para conferir a senha
    if (endereco.pathname === "/entrar") {
      return senhaCerta ? responder("ok") : responder("senha errada", 401);
    }

    // /dados -> ler (todo mundo) e guardar (só o dono)
    if (endereco.pathname === "/dados") {
      if (pedido.method === "GET") {
        const guardado = await env.SABEIME.get("dados");
        return responder(guardado || "{}", 200, json);     // se ainda não tem nada, devolve vazio
      }
      if (pedido.method === "PUT") {
        if (!senhaCerta) return responder("senha errada", 401);
        const corpo = await pedido.text();
        if (corpo.length > 20000000) return responder("muito grande", 413);   // limite de segurança
        try { JSON.parse(corpo); } catch (e) { return responder("dados inválidos", 400); }
        await env.SABEIME.put("dados", corpo);
        return responder("salvo");
      }
    }

    return responder("API do Restaurante Sabeime", 404);
  }
};
