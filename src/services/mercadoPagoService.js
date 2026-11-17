const crypto = require("node:crypto");
const { AuthError } = require("./authService");
const { exigirTeste } = require("./sampleCatalogService");

async function request(path, options = {}) {
  exigirTeste();
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new AuthError("Configure as credenciais da conta de teste Mercado Pago no servidor.", 409);
  const operacao = path === "/users/me" ? "validar_vendedor"
    : path === "/checkout/preferences" ? "criar_preferencia" : "consultar_ou_atualizar_pagamento";
  let statusProvedor;
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...options, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    });
    statusProvedor = response.status;
    if (!response.ok) throw new Error("Provedor indisponível");
    return await response.json();
  } catch {
    console.error(JSON.stringify({ evento: "falha_mercado_pago", operacao, statusProvedor }));
    if (statusProvedor === 401 || statusProvedor === 403) {
      throw new AuthError("O Mercado Pago rejeitou a credencial de teste da loja.", 409);
    }
    if (operacao === "criar_preferencia") {
      throw new AuthError("Não foi possível abrir o checkout de teste no Mercado Pago. Tente novamente.", 409);
    }
    throw new AuthError("Não foi possível consultar o Mercado Pago. Tente novamente.", 409);
  }
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
  let frontend;
  try { frontend = new URL(process.env.FRONTEND_URL); } catch { throw new AuthError("Configure FRONTEND_URL no servidor.", 409); }
  const local = frontend.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(frontend.hostname);
  // No teste local, a confirmação vem da consulta autenticada à API, sem webhook.
  const retorno = local ? null : urlPublica(process.env.FRONTEND_URL);
  if (retorno) {
    retorno.pathname = `/perfil/pedidos/${pedido._id}`;
    retorno.search = "";
    retorno.hash = "";
  }
  const webhook = local ? null : urlPublica(process.env.MP_WEBHOOK_URL);
  if (!local && !process.env.MP_WEBHOOK_SECRET) throw new AuthError("Configure MP_WEBHOOK_SECRET no servidor.", 409);
  const itensPagos = pedido.itens.filter((item) => item.precoUnitarioCentavos > 0)
    .map((item) => ({ id: item.lineId, title: item.nomeProduto, quantity: item.quantidade, unit_price: (item.totalLiquidoCentavos == null ? item.precoUnitarioCentavos : item.totalLiquidoCentavos / item.quantidade) / 100, currency_id: "BRL" }));
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
      ...(webhook ? { notification_url: webhook.toString() } : {}),
      ...(retorno ? {
        back_urls: { success: retorno.toString(), pending: retorno.toString(), failure: retorno.toString() },
        auto_return: "approved",
      } : {}),
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
// A origem autenticada é comprovada no adaptador, nunca por parâmetros do navegador.
// Contas test_user podem devolver live_mode=true mesmo no Checkout Pro de teste.
const pagamentosValidados = new WeakSet();
function validarContaPagamento(pagamento, vendedor) {
  if (String(pagamento.collector_id) !== String(vendedor.id) ||
      (pagamento.live_mode !== false && !(pagamento.live_mode === true && pagamento.metadata?.ambiente === 'teste' && pagamento.metadata?.order_id === pagamento.external_reference))) {
    throw new AuthError("Pagamento não pertence ao ambiente de teste.", 403);
  }
  pagamentosValidados.add(pagamento);
  return pagamento;
}
function pagamentoTesteValidado(pagamento) { return pagamentosValidados.has(pagamento); }
function valorPagamentoCentavos(pagamento) {
  const valor = Number(pagamento.transaction_amount), frete = Number(pagamento.shipping_amount ?? 0);
  if (!Number.isFinite(valor) || valor < 0 || !Number.isFinite(frete) || frete < 0) throw new AuthError('Valor do pagamento inválido.', 409);
  const total = Math.round(valor * 100) + Math.round(frete * 100);
  if (!Number.isSafeInteger(total) || total <= 0) throw new AuthError('Valor do pagamento inválido.', 409);
  return total;
}
async function consultarPagamento(id) {
  if (!/^\d{1,30}$/.test(String(id))) throw new AuthError("Identificador de pagamento inválido.");
  const vendedor = await vendedorTeste();
  const pagamento = await request(`/v1/payments/${id}`);
  return validarContaPagamento(pagamento, vendedor);
}
async function buscarPagamentos(orderId) {
  const vendedor = await vendedorTeste();
  const dados = await request(`/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=50`);
  if (dados.paging?.total > (dados.results || []).length) throw new AuthError("Há muitos pagamentos neste pedido. Não foi possível conferir todos agora.", 409);
  const encontrados = (dados.results || []).filter(p => String(p.collector_id) === String(vendedor.id));
  for (const pagamento of encontrados) {
    if (String(pagamento.external_reference) !== String(orderId)) throw new AuthError('Referência de pagamento inválida.', 409);
    validarContaPagamento(pagamento, vendedor);
  }
  return encontrados;
}
async function cancelarOuReembolsar(pagamento, orderId) {
  // Valida novamente o pagamento no provedor antes de qualquer alteração.
  const atual = await consultarPagamento(pagamento.id);
  if (String(atual.external_reference) !== String(orderId)) throw new AuthError("Pagamento não pertence ao pedido.", 409);
  if (atual.status === "approved") {
    await request(`/v1/payments/${atual.id}/refunds`, {
      method: "POST", body: JSON.stringify({}),
      headers: { "X-Idempotency-Key": crypto.createHash("sha256").update(`cancelamento-integral:${orderId}:${atual.id}`).digest("hex") },
    });
  } else if (["pending", "in_process", "authorized"].includes(atual.status)) {
    await request(`/v1/payments/${atual.id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  }
  const resultado = await consultarPagamento(atual.id);
  if (!["refunded", "cancelled", "rejected", "charged_back"].includes(resultado.status)) {
    throw new AuthError("Cancelamento solicitado. A confirmação do pagamento ou reembolso ainda está pendente. Tente atualizar novamente.", 409);
  }
  return resultado;
}
async function encerrarPreferencia(preferenceId) {
  if (!preferenceId) return;
  await vendedorTeste();
  await request(`/checkout/preferences/${encodeURIComponent(preferenceId)}`, {
    method: "PUT", body: JSON.stringify({ expires: true, expiration_date_from: new Date(Date.now() - 86400000).toISOString(), expiration_date_to: new Date(Date.now() - 1000).toISOString() }),
  });
}
function validarAssinatura(req) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  const id = req.query["data.id"];
  const requestId = req.get("x-request-id");
  const partes = Object.fromEntries((req.get("x-signature") || "").split(",").map((p) => p.trim().split("=")));
  if (!segredo || typeof id !== "string" || !/^\d{1,30}$/.test(id) || !requestId || !/^\d+$/.test(partes.ts || "") || !/^[a-f0-9]{64}$/i.test(partes.v1 || "")) throw new AuthError("Notificação inválida.", 401);
  const timestamp = Number(partes.ts) * (partes.ts.length <= 10 ? 1000 : 1);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60000) throw new AuthError("Notificação expirada.", 401);
  const manifesto = `id:${id};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest();
  if (!crypto.timingSafeEqual(esperado, Buffer.from(partes.v1, "hex"))) throw new AuthError("Assinatura inválida.", 401);
  return id;
}
module.exports = { pagamentoTesteValidado, valorPagamentoCentavos, criarPreferencia, consultarPagamento, buscarPagamentos, validarAssinatura, cancelarOuReembolsar, encerrarPreferencia };
