const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Order = require("../models/order");
const Payment = require("../models/payment");
const User = require("../models/User");
const shipping = require("./shippingService");
const Cart = require("../models/cart");
const { AuthError } = require("./authService");
const { obterEnderecoParaCheckout } = require("./addressService");
const catalog = require("./sampleCatalogService");
const mp = require("./mercadoPagoService");

function publico(p) {
  const pedido = p.toObject ? p.toObject() : p;
  return { id: String(pedido._id), status: pedido.status, criadoEm: pedido.createdAt, pagoEm: pedido.pagoEm,
    ambienteTeste: pedido.ambienteTeste, pagamentoTipo: pedido.pagamentoTipo, pagamentoStatus: pedido.pagamentoStatus,
    checkoutUrl: pedido.status === "aguardando_pagamento" ? pedido.checkoutUrl : null,
    subtotalCentavos: pedido.subtotalCentavos, freteCentavos: pedido.freteCentavos, descontoCentavos: pedido.descontoCentavos,
    frete: pedido.freteSnapshot || null, totalCentavos: pedido.totalCentavos, enderecoEntrega: pedido.enderecoEntrega,
    itens: pedido.itens.map((i) => ({ id: Number(i.lineId.replace("sample-", "")), nome: i.nomeProduto, quantidade: i.quantidade, precoCentavos: i.precoUnitarioCentavos, totalCentavos: i.totalLiquidoCentavos })),
  };
}
async function criarPedido(userId, dados = {}) {
  catalog.exigirTeste();
  const { enderecoId, chave, totalEsperadoCentavos, freteEsperadoCentavos } = dados;
  if (!mongoose.isObjectIdOrHexString(enderecoId) || typeof chave !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(chave)) throw new AuthError("Endereço ou chave do pedido inválidos.");
  const itens = catalog.normalizarItens(dados.itens);
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ enderecoId, itens, totalEsperadoCentavos, freteEsperadoCentavos })).digest("hex");
  const filtro = { userId, checkoutIdempotencyKey: chave };
  function conferir(pedido) {
    if (pedido.checkoutRequestFingerprint !== fingerprint || pedido.ambienteTeste !== true) throw new AuthError("Esta tentativa de compra possui outros dados. Inicie um novo pedido.", 409);
    return pedido;
  }
  const existente = await Order.findOne(filtro);
  if (existente) return conferir(existente);
  const produtos = catalog.catalogo().produtos;
  const linhas = itens.map((item) => {
    const produto = produtos.find((p) => p.id === item.id);
    const preco = Math.round(produto.price * 100);
    return { lineId: `sample-${item.id}`, productId: catalog.productId(item.id), variantId: catalog.variantId(item.id),
      nomeProduto: produto.name, sku: `TESTE-${item.id}`, quantidade: item.quantidade, precoUnitarioCentavos: preco,
      subtotalCentavos: preco * item.quantidade, descontoAlocadoCentavos: 0, totalLiquidoCentavos: preco * item.quantidade };
  });
  const usuario = await User.findOne({ _id: userId, ativo: true, "enderecos._id": enderecoId }).select("enderecos").lean();
  const endereco = usuario?.enderecos.find((item) => String(item._id) === enderecoId);
  if (!endereco) throw new AuthError("Selecione um endereço salvo na sua conta.");
  const frete = await shipping.cotarFrete(endereco.cep);
  const subtotal = linhas.reduce((s, i) => s + i.totalLiquidoCentavos, 0);
  const total = subtotal + frete.valorCentavos;
  if (!Number.isSafeInteger(totalEsperadoCentavos) || total !== totalEsperadoCentavos || frete.valorCentavos !== freteEsperadoCentavos) {
    throw new AuthError("O valor dos produtos ou do frete mudou. Recalcule o frete antes de confirmar.", 409);
  }
  try {
    return await mongoose.connection.transaction(async (session) => {
      const anterior = await Order.findOne(filtro).session(session);
      if (anterior) return conferir(anterior);
      const enderecoEntrega = await obterEnderecoParaCheckout({ userId, enderecoId, session }).catch(() => { throw new AuthError("Selecione um endereço salvo na sua conta."); });
      if (enderecoEntrega.cep !== frete.cep) throw new AuthError("O endereço mudou. Recalcule o frete antes de confirmar.", 409);
      const gratuito = total === 0;
      const [pedido] = await Order.create([{ ...filtro, checkoutRequestFingerprint: fingerprint, enderecoOrigemId: enderecoId,
        ambienteTeste: true, pagamentoTipo: gratuito ? "gratuito" : "mercado_pago", pagamentoStatus: gratuito ? "dispensado" : "pendente",
        itens: linhas, enderecoEntrega, subtotalCentavos: subtotal, totalCentavos: total, freteCentavos: frete.valorCentavos, freteSnapshot: frete, descontoCentavos: 0,
        status: gratuito ? "pago" : "aguardando_pagamento", pagoEm: gratuito ? new Date() : null,
        reserva: { status: gratuito ? "consumido" : "reservado", expiresAt: new Date(Date.now() + 14 * 60000) },
      }], { session });
      await Cart.updateOne({ userId }, { $set: { itens: gratuito ? [] : linhas.map((i) => ({ productId: i.productId, variantId: i.variantId, quantidade: i.quantidade })), couponId: null } }, { upsert: true, session });
      return pedido;
    });
  } catch (erro) {
    if (erro.code === 11000) {
      const pedido = await Order.findOne(filtro);
      if (pedido) return conferir(pedido);
    }
    throw erro;
  }
}
async function obterPedido(userId, id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new AuthError("Pedido não encontrado.", 404);
  const pedido = await Order.findOne({ _id: id, userId });
  if (!pedido) throw new AuthError("Pedido não encontrado.", 404);
  return pedido;
}
async function iniciarPagamento(userId, id) {
  catalog.exigirTeste();
  const pedido = await obterPedido(userId, id);
  if (!pedido.ambienteTeste || pedido.pagamentoTipo !== "mercado_pago" || pedido.totalCentavos <= 0 || pedido.status !== "aguardando_pagamento") throw new AuthError("Este pedido não precisa de pagamento.");
  if (pedido.reserva.expiresAt <= new Date()) throw new AuthError("Prazo de pagamento encerrado. Inicie um novo pedido.", 409);
  if (pedido.checkoutUrl) return pedido;
  const lock = await Order.updateOne({ _id: id, preferenceId: null, $or: [{ preferenceCriandoEm: null }, { preferenceCriandoEm: { $lt: new Date(Date.now() - 60000) } }] }, { $set: { preferenceCriandoEm: new Date() } });
  if (lock.modifiedCount !== 1) throw new AuthError("O pagamento está sendo preparado. Aguarde e tente novamente.", 409);
  try {
    const preferencia = await mp.criarPreferencia(pedido);
    return await Order.findByIdAndUpdate(id, { $set: { ...preferencia, preferenceCriandoEm: null } }, { returnDocument: "after" });
  } catch (erro) {
    await Order.updateOne({ _id: id }, { $set: { preferenceCriandoEm: null } });
    throw erro;
  }
}
async function aplicarPagamento(pagamento) {
  if (!mongoose.isObjectIdOrHexString(pagamento.external_reference)) return;
  await mongoose.connection.transaction(async (session) => {
    const pedido = await Order.findOne({ _id: pagamento.external_reference, ambienteTeste: true, pagamentoTipo: "mercado_pago" }).session(session);
    if (!pedido) return;
    if (pagamento.live_mode !== false || pagamento.currency_id !== "BRL" || Math.round(Number(pagamento.transaction_amount) * 100) !== pedido.totalCentavos || pedido.totalCentavos <= 0) throw new AuthError("Dados do pagamento não correspondem ao pedido.", 409);
    const providerId = String(pagamento.id);
    const existente = await Payment.findOne({ providerPaymentId: providerId }).session(session);
    const atualizadoEm = new Date(pagamento.date_last_updated);
    if (!Number.isFinite(atualizadoEm.getTime())) throw new AuthError("Pagamento sem data de atualização válida.", 409);
    if (existente?.providerUpdatedAt >= atualizadoEm) return;
    if (existente && String(existente.orderId) !== String(pedido._id)) throw new AuthError("Pagamento vinculado a outro pedido.", 409);
    const status = { approved: "aprovado", pending: "pendente", in_process: "em_processamento", rejected: "recusado", cancelled: "cancelado", refunded: "reembolsado", charged_back: "reembolsado" }[pagamento.status];
    if (!status) return;
    const aprovado = status === "aprovado";
    const reembolsado = status === "reembolsado";
    const metodo = pagamento.payment_type_id === "bank_transfer" ? "pix" : /card/.test(pagamento.payment_type_id || "") ? "cartao" : pagamento.payment_type_id === "ticket" ? "boleto" : "outro";
    const payment = existente || new Payment({ orderId: pedido._id, userId: pedido.userId, idempotencyKey: `mp-${providerId}`, providerPaymentId: providerId, metodo, valorCentavos: pedido.totalCentavos });
    payment.status = status; payment.providerStatus = pagamento.status; payment.providerUpdatedAt = atualizadoEm;
    payment.ultimaConsultaEm = new Date();
    payment.aprovadoEm = aprovado || reembolsado ? (pagamento.date_approved ? new Date(pagamento.date_approved) : new Date()) : null;
    payment.capturedCentavos = aprovado || reembolsado ? pedido.totalCentavos : 0;
    payment.refundSucceededCentavos = reembolsado ? pedido.totalCentavos : 0;
    await payment.save({ session });
    if (aprovado && pedido.status === "aguardando_pagamento") {
      pedido.status = "pago"; pedido.pagoEm = payment.aprovadoEm; pedido.reserva.status = "consumido"; pedido.pagamentoStatus = "aprovado";
    } else if (reembolsado && pedido.pagoEm) {
      // Só cancelar pelo pagamento que efetivamente foi aprovado para este pedido.
      const outroAprovado = await Payment.exists({ orderId: pedido._id, status: "aprovado", _id: { $ne: payment._id } }).session(session);
      if (!outroAprovado) { pedido.status = "cancelado"; pedido.canceladoEm = new Date(); pedido.reserva.status = "liberado"; pedido.pagamentoStatus = "reembolsado"; }
    } else if (!pedido.pagoEm && pedido.status === "aguardando_pagamento") {
      pedido.pagamentoStatus = status;
    }
    await pedido.save({ session });
  });
}
async function sincronizar(userId, id) {
  const pedido = await obterPedido(userId, id);
  if (pedido.pagamentoTipo === "mercado_pago" && pedido.ambienteTeste) {
    const pagamentos = await mp.buscarPagamentos(String(pedido._id));
    for (const pagamento of pagamentos) await aplicarPagamento(pagamento);
  }
  return obterPedido(userId, id);
}
module.exports = { publico, criarPedido, obterPedido, iniciarPagamento, aplicarPagamento, sincronizar };
