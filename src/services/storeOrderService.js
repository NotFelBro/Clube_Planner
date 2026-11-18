const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Order = require("../models/order");
const Payment = require("../models/payment");
const User = require("../models/User");
const shipping = require("./shippingService");
const { aplicarCupomFrete } = require("./shippingCouponService");
const Cart = require("../models/cart");
const Event = require("../models/adminEvent");
const { AuthError } = require("./authService");
const { obterEnderecoParaCheckout } = require("./addressService");
const catalog = require("./sampleCatalogService");
const liveCatalog = require("./catalogService");
const inventory = require("./storeInventoryService");
const mp = require("./mercadoPagoService");

function publico(p) {
  const pedido = p.toObject ? p.toObject() : p;
  return { id: String(pedido._id), status: pedido.status, criadoEm: pedido.createdAt, pagoEm: pedido.pagoEm,
    ambienteTeste: pedido.ambienteTeste, pagamentoTipo: pedido.pagamentoTipo, pagamentoStatus: pedido.pagamentoStatus,
    codigoRastreio: pedido.codigoRastreio || "", estoqueStatus: pedido.estoqueStatus, estoqueRetornoPendente: pedido.estoqueRetornoPendente === true,
    cancelamentoSolicitadoEm: pedido.cancelamentoSolicitadoEm || null,
    checkoutUrl: !pedido.cancelamentoSolicitadoEm && pedido.status === "aguardando_pagamento" ? pedido.checkoutUrl : null,
    subtotalCentavos: pedido.subtotalCentavos, freteCentavos: pedido.freteCentavos, descontoCentavos: pedido.descontoCentavos,
    frete: pedido.freteSnapshot || null, totalCentavos: pedido.totalCentavos, enderecoEntrega: pedido.enderecoEntrega,
    itens: pedido.itens.map((i) => ({ id: Number(i.lineId.replace("sample-", "")), nome: i.nomeProduto, quantidade: i.quantidade, precoCentavos: i.precoUnitarioCentavos, totalCentavos: i.totalLiquidoCentavos })),
  };
}
async function criarPedido(userId, dados = {}) {
  catalog.exigirTeste();
  const { enderecoId, chave, totalEsperadoCentavos, freteEsperadoCentavos, cupomFrete = "" } = dados;
  if (!mongoose.isObjectIdOrHexString(enderecoId) || typeof chave !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(chave)) throw new AuthError("Endereço ou chave do pedido inválidos.");
  const itens = liveCatalog.normalizarItens(dados.itens);
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ enderecoId, itens, totalEsperadoCentavos, freteEsperadoCentavos, cupomFrete })).digest("hex");
  const filtro = { userId, checkoutIdempotencyKey: chave };
  function conferir(pedido) {
    if (pedido.checkoutRequestFingerprint !== fingerprint || pedido.ambienteTeste !== true) throw new AuthError("Esta tentativa de compra possui outros dados. Inicie um novo pedido.", 409);
    return pedido;
  }
  const existente = await Order.findOne(filtro);
  if (existente) return conferir(existente);
  const produtos = (await liveCatalog.catalogo({ interno: true })).produtos;
  liveCatalog.normalizarItens(itens, produtos);
  const linhas = itens.map((item) => {
    const produto = produtos.find((p) => p.id === item.id);
    const liquido = Math.round(produto.price * 100);
    const preco = Math.round((produto.originalPrice ?? produto.price) * 100);
    return { precoCatalogoCentavos: produto.precoCatalogoCentavos, precoReferenciaCentavos: produto.precoReferenciaCentavos, categoriaId: produto.categoriaId, cupomNivel: produto.shippingCouponLevel, lineId: `sample-${item.id}`, productId: produto.productId, variantId: produto.variantId,
      nomeProduto: produto.name, sku: `TESTE-${item.id}`, quantidade: item.quantidade, precoUnitarioCentavos: preco,
      subtotalCentavos: preco * item.quantidade, descontoAlocadoCentavos: (preco - liquido) * item.quantidade, totalLiquidoCentavos: liquido * item.quantidade };
  });
  const usuario = await User.findOne({ _id: userId, ativo: true, "enderecos._id": enderecoId }).select("enderecos").lean();
  const endereco = usuario?.enderecos.find((item) => String(item._id) === enderecoId);
  if (!endereco) throw new AuthError("Selecione um endereço salvo na sua conta.");
  const frete = aplicarCupomFrete(await shipping.cotarFrete(endereco.cep), itens, cupomFrete, produtos);
  const subtotal = linhas.reduce((s, i) => s + i.subtotalCentavos, 0);
  const desconto = linhas.reduce((s, i) => s + i.descontoAlocadoCentavos, 0);
  const total = subtotal - desconto + frete.valorCentavos;
  if (!Number.isSafeInteger(totalEsperadoCentavos) || total !== totalEsperadoCentavos || frete.valorCentavos !== freteEsperadoCentavos) {
    throw new AuthError("O valor dos produtos ou do frete mudou. Recalcule o frete antes de confirmar.", 409);
  }
  try {
    return await mongoose.connection.transaction(async (session) => {
      const anterior = await Order.findOne(filtro).session(session);
      if (anterior) return conferir(anterior);
      const enderecoEntrega = await obterEnderecoParaCheckout({ userId, enderecoId, session }).catch(() => { throw new AuthError("Selecione um endereço salvo na sua conta."); });
      if (enderecoEntrega.cep !== frete.cep) throw new AuthError("O endereço mudou. Recalcule o frete antes de confirmar.", 409);
      await inventory.reservar(linhas, session);
      const gratuito = total === 0;
      const criadoEm = new Date();
      const [pedido] = await Order.create([{ ...filtro, createdAt: criadoEm, checkoutRequestFingerprint: fingerprint, enderecoOrigemId: enderecoId,
        estoqueControlado: true, estoqueStatus: "reservado",
        ambienteTeste: true, pagamentoTipo: gratuito ? "gratuito" : "mercado_pago", pagamentoStatus: gratuito ? "dispensado" : "pendente",
        itens: linhas, enderecoEntrega, subtotalCentavos: subtotal, totalCentavos: total, freteCentavos: frete.valorCentavos, freteSnapshot: frete, descontoCentavos: desconto,
        status: gratuito ? "pago" : "aguardando_pagamento", pagoEm: gratuito ? new Date() : null,
        reserva: { status: gratuito ? "consumido" : "reservado", expiresAt: new Date(criadoEm.getTime() + 15 * 60000) },
      }], { session });
      if (gratuito) { await inventory.movimentar(pedido, "consumir", session); await pedido.save({ session }); }
      await Event.create([{ actorId: userId, acao: "pedido.criacao", entidadeId: String(pedido._id), descricao: "Pedido recebido pela loja" }], { session });
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
  if (pedido.cancelamentoSolicitadoEm) throw new AuthError("O cancelamento deste pedido já foi solicitado.", 409);
  if (!pedido.ambienteTeste || pedido.pagamentoTipo !== "mercado_pago" || pedido.totalCentavos <= 0 || pedido.status !== "aguardando_pagamento") throw new AuthError("Este pedido não precisa de pagamento.");
  if (pedido.reserva.expiresAt <= new Date()) throw new AuthError("Prazo de pagamento encerrado. Inicie um novo pedido.", 409);
  if (pedido.checkoutUrl) return pedido;
  const lock = await Order.updateOne({ _id: id, cancelamentoSolicitadoEm: null, status: "aguardando_pagamento", preferenceId: null, $or: [{ preferenceCriandoEm: null }, { preferenceCriandoEm: { $lt: new Date(Date.now() - 60000) } }] }, { $set: { preferenceCriandoEm: new Date() } });
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
    if ((pagamento.live_mode !== false && !mp.pagamentoTesteValidado(pagamento)) || pagamento.currency_id !== "BRL" || mp.valorPagamentoCentavos(pagamento) !== pedido.totalCentavos || pedido.totalCentavos <= 0) throw new AuthError("Dados do pagamento não correspondem ao pedido.", 409);
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
    payment.aprovadoEm = aprovado || reembolsado ? (pagamento.date_approved ? new Date(pagamento.date_approved) : existente?.aprovadoEm || new Date()) : null;
    if (Array.isArray(pagamento.fee_details) && pagamento.fee_details.every(f => Number.isFinite(Number(f.amount)) && Number(f.amount) >= 0)) payment.taxasCentavos = Math.round(pagamento.fee_details.reduce((s, f) => s + Number(f.amount), 0) * 100);
    if (reembolsado) payment.refundUpdatedAt = atualizadoEm;
    payment.capturedCentavos = aprovado || reembolsado ? pedido.totalCentavos : 0;
    payment.refundSucceededCentavos = reembolsado ? pedido.totalCentavos : 0;
    await payment.save({ session });
    const aprovadoNoPrazo = payment.aprovadoEm && payment.aprovadoEm <= pedido.reserva.expiresAt;
    const expiradoAutomaticamente = pedido.status === 'cancelado' && pedido.cancelamentoOrigem === 'reserva_expirada';
    if (aprovado && (pedido.status === "aguardando_pagamento" || expiradoAutomaticamente)) {
      if (pedido.estoqueControlado && !aprovadoNoPrazo) {
        await inventory.movimentar(pedido, "liberar", session);
        pedido.status = "cancelado"; pedido.canceladoEm = new Date(); pedido.cancelamentoSolicitadoEm = new Date(); pedido.cancelamentoOrigem = 'reserva_expirada'; pedido.reserva.status = "liberado";
      } else {
        await inventory.movimentar(pedido, expiradoAutomaticamente ? "recuperar" : "consumir", session);
        pedido.status = "pago"; pedido.pagoEm = payment.aprovadoEm; pedido.reserva.status = "consumido"; pedido.pagamentoStatus = "aprovado";
        if (expiradoAutomaticamente) { pedido.cancelamentoOrigem = null; pedido.cancelamentoSolicitadoEm = null; pedido.canceladoEm = null; }
        await Cart.updateOne({ userId: pedido.userId }, { $set: { itens: [], couponId: null } }, { session });
      }
    } else if (reembolsado && (pedido.pagoEm || pedido.cancelamentoSolicitadoEm)) {
      // Só cancelar pelo pagamento que efetivamente foi aprovado para este pedido.
      const outroAprovado = await Payment.exists({ orderId: pedido._id, status: "aprovado", _id: { $ne: payment._id } }).session(session);
      if (!outroAprovado) {
        if (pedido.estoqueControlado && ["enviado", "entregue"].includes(pedido.status)) pedido.estoqueRetornoPendente = true;
        if (!pedido.estoqueRetornoPendente && !["enviado", "entregue"].includes(pedido.status)) {
          await inventory.movimentar(pedido, pedido.estoqueStatus === "consumido" ? "devolver" : "liberar", session);
        }
        pedido.status = "cancelado"; pedido.canceladoEm = new Date(); pedido.reserva.status = "liberado"; pedido.pagamentoStatus = "reembolsado"; }
    } else if (!pedido.pagoEm && pedido.status === "aguardando_pagamento") {
      pedido.pagamentoStatus = status;
    }
    await pedido.save({ session });
    await Event.create([{ actorId: pedido.userId, acao: `pagamento.${status}`, entidadeId: String(pedido._id), descricao: `Pagamento ${status} confirmado pelo provedor` }], { session });
  });
  if (pagamento.status === "approved") {
    const cancelado = await Order.findOne({ _id: pagamento.external_reference, cancelamentoSolicitadoEm: { $ne: null }, ambienteTeste: true });
    if (cancelado) {
      const resultado = await mp.cancelarOuReembolsar(pagamento, cancelado._id);
      await aplicarPagamento(resultado);
    }
  }
}
async function sincronizar(userId, id) {
  const pedido = await obterPedido(userId, id);
  if (pedido.cancelamentoSolicitadoEm && pedido.cancelamentoOrigem !== "reserva_expirada") return cancelarPedido(userId, id);
  if (pedido.pagamentoTipo === "mercado_pago" && pedido.ambienteTeste) {
    const pagamentos = await mp.buscarPagamentos(String(pedido._id));
    for (const pagamento of pagamentos) await aplicarPagamento(pagamento);
  }
  return obterPedido(userId, id);
}
async function cancelarPedido(userId, id) {
  catalog.exigirTeste();
  const pedido = await obterPedido(userId, id);
  if (!pedido.ambienteTeste) throw new AuthError("Cancelamento indisponível para este pedido.", 409);
  if (pedido.status === "entregue") throw new AuthError("Este pedido já foi entregue e não pode ser cancelado por aqui.", 409);
  const permitido = ["aguardando_pagamento", "pago", "em_preparacao", "enviado", "cancelado"];
  if (!permitido.includes(pedido.status)) throw new AuthError("Este pedido não pode ser cancelado.", 409);
  // Intenção durável: bloqueia novos pagamentos e permite retomar após falhas de rede.
  const marcado = await Order.findOneAndUpdate({ _id: id, userId, status: { $in: permitido }, preferenceCriandoEm: null },
    { $set: { cancelamentoOrigem: "cliente", cancelamentoSolicitadoEm: pedido.cancelamentoSolicitadoEm || new Date() } }, { returnDocument: "after" });
  if (!marcado) throw new AuthError("O pedido está sendo atualizado. Tente novamente.", 409);
  if (marcado.pagamentoTipo === "mercado_pago" && (marcado.preferenceId || marcado.pagoEm)) {
    // A preferência já tem o mesmo prazo da reserva. Depois desse prazo, o
    // reembolso pode seguir sem tentar editar um checkout que já expirou.
    if (marcado.preferenceId && !(marcado.reserva?.expiresAt <= new Date())) {
      await mp.encerrarPreferencia(marcado.preferenceId);
    }
    const pagamentos = await mp.buscarPagamentos(String(id));
    for (const pagamento of pagamentos) {
      if (mp.valorPagamentoCentavos(pagamento) !== marcado.totalCentavos || pagamento.currency_id !== "BRL") throw new AuthError("Valor do pagamento não corresponde ao pedido.", 409);
      const resultado = await mp.cancelarOuReembolsar(pagamento, id);
      await aplicarPagamento(resultado);
    }
    if (marcado.pagoEm && !pagamentos.some(p => ["approved", "refunded", "charged_back"].includes(p.status))) throw new AuthError("Não foi possível confirmar o pagamento para reembolso. Tente novamente.", 409);
  }
  if (marcado.estoqueControlado) {
    await mongoose.connection.transaction(async session => {
      const atual = await Order.findOne({ _id: id, userId, status: { $in: permitido } }).session(session);
      if (!atual) throw new AuthError("O pedido mudou durante o cancelamento.", 409);
      if (["enviado", "entregue"].includes(atual.status) && atual.estoqueStatus === "consumido") atual.estoqueRetornoPendente = true;
      if (!atual.estoqueRetornoPendente && !["enviado", "entregue"].includes(atual.status)) await inventory.movimentar(atual, atual.estoqueStatus === "consumido" ? "devolver" : "liberar", session);
      if (atual.status !== "cancelado") await Event.create([{ actorId: userId, acao: "pedido.cancelamento", entidadeId: String(atual._id), descricao: "Cancelamento confirmado e estoque atualizado" }], { session });
      atual.status = "cancelado"; atual.canceladoEm ||= new Date(); atual.reserva.status = "liberado"; atual.checkoutUrl = null;
      await atual.save({ session });
    });
  } else {
    await Order.updateOne({ _id: id, userId, status: { $in: permitido } }, { $set: {
      status: "cancelado", canceladoEm: marcado.canceladoEm || new Date(), "reserva.status": "liberado", checkoutUrl: null,
    } });
  }
  return obterPedido(userId, id);
}
module.exports = { publico, criarPedido, obterPedido, iniciarPagamento, aplicarPagamento, sincronizar, cancelarPedido };
