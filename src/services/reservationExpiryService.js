const mongoose = require('mongoose');
const Order = require('../models/order');
const Product = require('../models/product');
const CouponRedemption = require('../models/couponRedemption');
const { liberarCupom } = require('./checkoutService');

async function expirarReserva(orderId, agora = new Date()) {
  return mongoose.connection.transaction(async session => {
    const pedido = await Order.findOne({ _id: orderId, $or: [{ ambienteTeste: { $ne: true } }, { estoqueControlado: true }], status: 'aguardando_pagamento', 'reserva.status': 'reservado', 'reserva.expiresAt': { $lte: agora } }).session(session);
    if (!pedido) return false;
    if (pedido.estoqueControlado) await require('./storeInventoryService').movimentar(pedido, 'liberar', session);
    else for (const item of pedido.itens) {
      const resultado = await Product.updateOne({ _id: item.productId, variacoes: { $elemMatch: { _id: item.variantId, estoqueReservado: { $gte: item.quantidade } } } },
        { $inc: { 'variacoes.$.estoqueDisponivel': item.quantidade, 'variacoes.$.estoqueReservado': -item.quantidade } }, { session });
      if (resultado.modifiedCount !== 1) throw new Error('Reserva de estoque inconsistente.');
    }
    if (pedido.couponId) {
      const reserva = await CouponRedemption.findOne({ orderId: pedido._id, couponId: pedido.couponId }).session(session);
      if (!reserva) throw new Error('Reserva de cupom inconsistente.');
      await liberarCupom({ redemptionId: reserva._id, session });
    }
    if (pedido.estoqueControlado) { pedido.cancelamentoOrigem = 'reserva_expirada'; pedido.cancelamentoSolicitadoEm = agora; pedido.checkoutUrl = null; }
    pedido.status = 'cancelado'; pedido.canceladoEm = agora; pedido.reserva.status = 'liberado';
    await pedido.save({ session });
    return true;
  });
}
async function expirarReservas() {
  const pedidos = await Order.find({ $or: [{ ambienteTeste: { $ne: true } }, { estoqueControlado: true }], status: 'aguardando_pagamento', 'reserva.status': 'reservado', 'reserva.expiresAt': { $lte: new Date() } }).select('_id').sort({ 'reserva.expiresAt': 1 }).limit(50).lean();
  let liberados = 0;
  for (const pedido of pedidos) if (await expirarReserva(pedido._id)) liberados++;
  return liberados;
}
function iniciarExpiracaoReservas() {
  let executando = false;
  const executar = async () => {
    if (executando) return;
    executando = true;
    try { await expirarReservas(); }
    catch { console.error('Falha ao expirar reservas de estoque; nova tentativa no próximo ciclo.'); }
    finally { executando = false; }
  };
  const timer = setInterval(executar, 60000); timer.unref();
  return () => clearInterval(timer);
}
module.exports = { expirarReserva, expirarReservas, iniciarExpiracaoReservas };
