/* =====================================================
   TEXTOS LEGAIS: Política de Privacidade e Termos de Uso
   Preencha os dados da empresa aqui embaixo. O que ficar
   vazio ("") simplesmente não aparece nos textos.
   ===================================================== */
const EMPRESA = {
  nome: "Restaurante Sabeime",
  razao: "",      // razão social (se tiver)
  cnpj: "",       // CNPJ (se tiver)
  endereco: "",   // endereço do restaurante
  email: ""       // e-mail para contato
};
const ATUALIZADO_EM = "29 de outubro de 2026";

// Telefone bonito, tirado do número do WhatsApp que já está no script.js
const FONE = "(" + WHATS.slice(2, 4) + ") " + WHATS.slice(4, -4) + "-" + WHATS.slice(-4);
const CONTATO = `WhatsApp <a href="https://wa.me/${WHATS}" target="_blank" rel="noopener">${FONE}</a>${EMPRESA.email ? ` ou e-mail <a href="mailto:${esc(EMPRESA.email)}">${esc(EMPRESA.email)}</a>` : ""}`;
const QUEM = `<strong>${esc(EMPRESA.razao || EMPRESA.nome)}</strong>${EMPRESA.cnpj ? ", CNPJ " + esc(EMPRESA.cnpj) : ""}${EMPRESA.endereco ? ", com endereço em " + esc(EMPRESA.endereco) : ""}`;

const TEXTO_PRIVACIDADE = `
<h1>Política de Privacidade</h1>
<p class="dica">Última atualização: ${ATUALIZADO_EM}</p>
<div class="resumo-legal"><strong>Em resumo:</strong> usamos seus dados só para receber, preparar e entregar o seu pedido. O pedido sai do site direto para o nosso WhatsApp, e o site não guarda o seu nome nem o seu endereço. Não vendemos dados, não usamos cookies de propaganda e você pode pedir para apagar o que tivermos sobre você.</div>

<h2>1. Quem é o responsável</h2>
<p>${QUEM} é o responsável pelos dados pessoais tratados neste site, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Contato: ${CONTATO}.</p>

<h2>2. Quais dados usamos e para quê</h2>
<ul>
<li><strong>Dados do pedido:</strong> seu nome, os itens escolhidos, se é retirada ou entrega, bairro, rua, número e complemento (só na entrega), forma de pagamento, valor do troco e observações. Usamos para receber, preparar, entregar e cobrar o pedido e falar com você sobre ele (LGPD, art. 7º, V: execução de contrato a pedido do cliente).</li>
<li><strong>Conversa pelo WhatsApp:</strong> o que você nos enviar lá, para atender sua solicitação.</li>
<li><strong>Dados técnicos de acesso:</strong> endereço IP, tipo de aparelho e navegador, data e hora. Chegam automaticamente aos serviços que mantêm o site no ar, para o site funcionar e ficar seguro (art. 7º, IX: legítimo interesse).</li>
<li><strong>Obrigações da lei:</strong> quando a lei exigir (por exemplo, registros fiscais), guardamos as informações necessárias (art. 7º, II).</li>
</ul>
<p>Este site não pede CPF, número de cartão nem senhas de pagamento. No Pix, o pagamento acontece no app do seu banco, e o site só descobre se o Pix foi pago.</p>

<h2>3. Como o pedido chega até nós</h2>
<p>Quando você toca em "Enviar pedido", o site abre o WhatsApp com a mensagem pronta. O que você digitou fica só na memória do seu navegador enquanto a página está aberta e some quando você a fecha. O envio acontece pelo WhatsApp, que tem a própria política de privacidade. Se você escolher pagar por Pix, o site pede ao Mercado Pago uma cobrança com o valor do pedido, mostra o QR code e o Pix copia e cola e confere se o Pix foi pago. O Mercado Pago recebe só o valor e um código do pedido, e não recebe seu nome nem seu endereço.</p>

<h2>4. Cookies</h2>
<p>Este site não usa cookies de propaganda nem ferramentas de estatística ou de rastreamento. Se isso mudar, avisaremos aqui.</p>

<h2>5. Com quem compartilhamos</h2>
<ul>
<li><strong>WhatsApp (Meta):</strong> por onde o pedido é enviado e a conversa acontece.</li>
<li><strong>Cloudflare:</strong> mantém o site no ar, guarda o cardápio, os preços e as fotos, faz a ponte com o Mercado Pago no Pix. Não guarda dados de clientes.</li>
<li><strong>Mercado Pago:</strong> gera a cobrança Pix e informa se ela foi paga. Quando você paga, o Pix aparece na conta do restaurante com os dados que o próprio Pix informa (como o nome de quem pagou). Seus dados de pagamento ficam com o seu banco e com o Mercado Pago, que têm políticas próprias.</li>
<li><strong>Google:</strong> fornece as letras do site (Google Fonts), que recebem seu IP ao carregar, e a página de avaliações, se você clicar no link.</li>
<li><strong>Quem fizer a entrega:</strong> recebe só o necessário (nome e endereço).</li>
<li><strong>Autoridades:</strong> quando a lei ou uma ordem judicial exigir.</li>
</ul>
<p>Não vendemos nem alugamos dados pessoais. Alguns desses serviços podem tratar dados em servidores fora do Brasil, seguindo as regras da LGPD.</p>

<h2>6. Por quanto tempo guardamos</h2>
<p>Pelo tempo necessário para atender o pedido, resolver reclamações e cumprir obrigações legais. Depois disso, apagamos ou deixamos de usar.</p>

<h2>7. Seus direitos</h2>
<p>Pela LGPD (art. 18), você pode pedir a qualquer momento: confirmação de que tratamos seus dados; acesso a eles; correção de dados errados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre com quem compartilhamos; informação sobre a possibilidade de não consentir; e a revogação do consentimento. Para pedir, fale com a gente: ${CONTATO}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener">gov.br/anpd</a>.</p>

<h2>8. Segurança</h2>
<p>O site usa conexão segura (HTTPS) e o painel de edição só abre com senha. Nenhum sistema é 100% seguro, mas tomamos cuidados para proteger seus dados e, se houver um incidente que traga risco a você, avisaremos como a lei determina.</p>

<h2>9. Crianças e adolescentes</h2>
<p>O site é feito para maiores de 18 anos. Menores devem pedir com a ajuda de um responsável. Não coletamos dados de crianças de propósito; se isso acontecer, fale com a gente e apagaremos.</p>

<h2>10. Links para outros sites</h2>
<p>O site tem links para WhatsApp, Google e Instagram. Cada um deles tem sua própria política, e não nos responsabilizamos por ela.</p>

<h2>11. Mudanças nesta política</h2>
<p>Podemos atualizar este texto quando o site mudar. A data da última atualização fica no topo da página.</p>`;

const TEXTO_TERMOS = `
<h1>Termos de Uso</h1>
<p class="dica">Última atualização: ${ATUALIZADO_EM}</p>
<div class="resumo-legal"><strong>Em resumo:</strong> este site mostra o cardápio e ajuda você a montar o pedido e enviá-lo pelo WhatsApp. O pedido só vale depois que a gente confirmar com você.</div>

<h2>1. Aceitação</h2>
<p>Ao usar este site, você concorda com estes termos e com a <a href="#privacidade">Política de Privacidade</a>. Se não concordar, não use o site. O site é de ${QUEM}.</p>

<h2>2. O que o site faz</h2>
<p>Mostra o cardápio, os preços e as carnes do dia, e monta uma mensagem de pedido para você enviar pelo WhatsApp. No Pix, o pagamento é feito no app do seu banco, em uma cobrança gerada pelo Mercado Pago, e o site não recebe dados do seu cartão nem da sua conta.</p>

<h2>3. Como funcionam os pedidos</h2>
<p>Enviar a mensagem é um pedido, não uma compra fechada. O pedido só é confirmado quando respondermos pelo WhatsApp. Podemos recusar ou ajustar um pedido por falta de item, endereço fora da área de entrega ou dados incompletos, sempre avisando você.</p>

<h2>4. Cardápio, preços e fotos</h2>
<p>O cardápio muda e os itens podem acabar durante o dia. Os preços valem na hora do pedido e podem ser alterados. As fotos são ilustrativas, e o prato pode ter pequenas diferenças.</p>

<h2>5. Pagamento, retirada e entrega</h2>
<p>O Pix é pago pelo site, antes de o pedido seguir para o WhatsApp, e a cobrança vale por 30 minutos. Dinheiro e cartão são pagos direto ao restaurante, na retirada ou na entrega. Na retirada, aceitamos Pix, dinheiro e cartão. Na entrega, aceitamos Pix e dinheiro. Valores e condições de entrega, quando houver, são informados no atendimento.</p>

<h2>6. Alterações e cancelamentos</h2>
<p>Por ser comida preparada, mudanças e cancelamentos só são possíveis antes de começarmos o preparo. Fale com a gente o quanto antes pelo WhatsApp. Se não conseguirmos atender um pedido já pago, devolvemos o valor. Isso não tira os direitos que o Código de Defesa do Consumidor garante a você.</p>

<h2>7. Alergias e restrições alimentares</h2>
<p>Se você tem alergia ou restrição alimentar, avise antes de pedir, no campo de observação ou pelo WhatsApp. Nossa cozinha manipula vários ingredientes, então não conseguimos garantir ausência total de traços.</p>

<h2>8. Suas responsabilidades</h2>
<p>Informe dados verdadeiros e completos. Não tente acessar o painel do dono sem autorização, nem atrapalhar ou copiar o funcionamento do site de forma indevida.</p>

<h2>9. Direitos autorais e marca</h2>
<p>© ${new Date().getFullYear()} ${esc(EMPRESA.nome)}. Todos os direitos reservados. A marca, a logo, os textos, as imagens e o visual deste site pertencem ao restaurante ou a quem nos autorizou a usá-los. Não é permitido copiar, reproduzir ou usar esse conteúdo sem autorização por escrito, salvo nos casos que a lei permite (Lei nº 9.610/1998).</p>

<h2>10. Serviços de terceiros</h2>
<p>O site usa WhatsApp, Google e Cloudflare. Eles podem sair do ar ou mudar as regras deles, e isso foge do nosso controle.</p>

<h2>11. Limite de responsabilidade</h2>
<p>Fazemos o possível para o site funcionar sem erros, mas ele é oferecido como está, e pode ficar fora do ar por falhas de internet ou de terceiros. Dentro do que a lei permite, não respondemos por prejuízos causados por esses problemas.</p>

<h2>12. Mudanças nestes termos</h2>
<p>Podemos atualizar estes termos. Vale a versão publicada aqui, com a data no topo.</p>

<h2>13. Lei aplicável e contato</h2>
<p>Estes termos seguem as leis do Brasil, e o foro é o da comarca do consumidor. Dúvidas? ${CONTATO}.</p>`;

// Mostra o texto escolhido na tela de textos legais
function desenharLegal(qual) {
  $("conteudoLegal").innerHTML = qual === "termos" ? TEXTO_TERMOS : TEXTO_PRIVACIDADE;
  $("abaPrivacidade").removeAttribute("aria-current"); $("abaTermos").removeAttribute("aria-current");
  $(qual === "termos" ? "abaTermos" : "abaPrivacidade").setAttribute("aria-current", "page");
  document.title = (qual === "termos" ? "Termos de Uso" : "Política de Privacidade") + " | " + EMPRESA.nome;
}

// Direitos autorais e dados da empresa no rodapé
document.querySelectorAll(".direitos:not(:has(a))").forEach(p => p.textContent = `© ${new Date().getFullYear()} ${EMPRESA.nome}. Todos os direitos reservados.`);
$("dadosEmpresa").innerHTML = [EMPRESA.razao && esc(EMPRESA.razao), EMPRESA.cnpj && "CNPJ " + esc(EMPRESA.cnpj), EMPRESA.endereco && esc(EMPRESA.endereco), `WhatsApp ${FONE}`].filter(Boolean).join("<br>");
