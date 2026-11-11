const crypto = require("node:crypto");
const { AuthError } = require("./authService");
const { exigirTeste } = require("./sampleCatalogService");

async function request(path, options = {}) {
  exigirTeste();
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new AuthError("Configure as credenciais da conta de teste Mercado Pago no servidor.", 409);
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...options, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    });
    if (!response.ok) throw new Error("Provedor indisponível");
    return await response.json();
  } catch { throw new AuthError("Não foi possível consultar o Mercado Pago. Tente novamente.", 409); }
}
async function vendedorTeste() {
  const vendedor = await request("/users/me");
  if (!vendedor.tags?.includes("test_user")) throw new AuthError("Use exclusivamente uma conta de vendedor de teste do Mercado Pago.", 403);
  return vendedor;
}
function urlPublica(valor) {
  try { const url = new URL(valor); if (url.protocol === "https:" && !url.username && !url.password) return url; } catch { /* Validar abaixo. */ }
  throw new AuthError("Configure FRONTEND_URL e MP_WEBHOOK_URL como URLs públicas HTTPS para o teste Mercado Pago.", 409);
}
async function criarPreferencia(pedido) {
  await vendedorTeste();
  const retorno = urlPublica(process.env.FRONTEND_URL);
  retorno.pathname = `/perfil/pedidos/${pedido._id}`;
  retorno.search = "";
  const webhook = urlPublica(process.env.MP_WEBHOOK_URL);
  if (!process.env.MP_WEBHOOK_SECRET) throw new AuthError("Configure MP_WEBHOOK_SECRET no servidor.", 409);
  const itensPagos = pedido.itens.filter((item) => item.precoUnitarioCentavos > 0)
    .map((item) => ({ id: item.lineId, title: item.nomeProduto, quantity: item.quantidade, unit_price: item.precoUnitarioCentavos / 100, currency_id: "BRL" }));
  const frete = pedido.freteCentavos || 0;
  const somenteFrete = itensPagos.length === 0;
  const items = somenteFrete
    ? [{ id: "frete", title: "Frete — entrega do pedido", quantity: 1, unit_price: frete / 100, currency_id: "BRL" }]
    : itensPagos;
  const preference = await request("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items,
      ...(!somenteFrete && frete > 0 ? { shipments: { mode: "not_specified", cost: frete / 100 } } : {}),
      external_reference: String(pedido._id),
      metadata: { order_id: String(pedido._id), ambiente: "teste" },
      notification_url: webhook.toString(),
      back_urls: { success: retorno.toString(), pending: retorno.toString(), failure: retorno.toString() },
      auto_return: "approved",
      expires: true,
      expiration_date_to: pedido.reserva.expiresAt.toISOString(),
    }),
  });
  const checkoutUrl = preference.sandbox_init_point;
  let url;
  try { url = new URL(checkoutUrl); } catch { throw new AuthError("Checkout de teste indisponível.", 409); }
  if (url.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname)) throw new AuthError("Endereço de checkout inválido.", 409);
  if (!preference.id) throw new AuthError("Preferência inválida.", 409);
  return { preferenceId: String(preference.id), checkoutUrl };
}
async function consultarPagamento(id) {
  if (!/^\d{1,30}$/.test(String(id))) throw new AuthError("Identificador de pagamento inválido.");
  const vendedor = await vendedorTeste();
  const pagamento = await request(`/v1/payments/${id}`);
  if (pagamento.live_mode !== false || String(pagamento.collector_id) !== String(vendedor.id)) throw new AuthError("Pagamento não pertence ao ambiente de teste.", 403);
  return pagamento;
}
async function buscarPagamentos(orderId) {
  const vendedor = await vendedorTeste();
  const dados = await request(`/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=50`);
  return (dados.results || []).filter((p) => p.live_mode === false && String(p.collector_id) === String(vendedor.id));
}
function validarAssinatura(req) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  const id = req.query["data.id"];
  const requestId = req.get("x-request-id");
  const partes = Object.fromEntries((req.get("x-signature") || "").split(",").map((p) => p.trim().split("=")));
  if (!segredo || typeof id !== "string" || !/^\d{1,30}$/.test(id) || !requestId || !/^\d+$/.test(partes.ts || "") || !/^[a-f0-9]{64}$/i.test(partes.v1 || "")) throw new AuthError("Notificação inválida.", 401);
  const manifesto = `id:${id};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest();
  if (!crypto.timingSafeEqual(esperado, Buffer.from(partes.v1, "hex"))) throw new AuthError("Assinatura inválida.", 401);
  return id;
}
module.exports = { criarPreferencia, consultarPagamento, buscarPagamentos, validarAssinatura };
