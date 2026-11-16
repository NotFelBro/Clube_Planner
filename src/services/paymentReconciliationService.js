const Order = require('../models/order');
const orders = require('./storeOrderService');
const catalog = require('./sampleCatalogService');

async function conciliarPedidos({ userId, limite = 10 } = {}) {
  if (!catalog.configuracao().habilitado || !process.env.MP_ACCESS_TOKEN) return { consultados: 0, falhas: 0 };
  const agora = new Date();
  const elegivel = {
    ambienteTeste: true, pagamentoTipo: 'mercado_pago', preferenceId: { $type: 'string' },
    pagamentoStatus: { $ne: 'reembolsado' },
    createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
    ...(userId ? { userId } : {}),
    $or: [{ pagamentoConsultadoEm: null }, { pagamentoConsultadoEm: { $lte: new Date(Date.now() - 30000) } }],
  };
  const lista = await Order.find(elegivel).select('_id userId').sort({ pagamentoConsultadoEm: 1, createdAt: -1 }).limit(Math.min(limite, 20)).maxTimeMS(5000).lean();
  let consultados = 0, falhas = 0;
  // Dois pedidos por vez e uma reserva atômica por pedido limitam chamadas entre abas/processos.
  for (let i = 0; i < lista.length; i += 2) await Promise.all(lista.slice(i, i + 2).map(async pedido => {
    const lock = await Order.updateOne({ ...elegivel, _id: pedido._id }, { $set: { pagamentoConsultadoEm: agora } });
    if (lock.modifiedCount !== 1) return;
    consultados++;
    try { await orders.sincronizar(String(pedido.userId), String(pedido._id)); }
    catch { falhas++; console.error('Conciliação de pagamento pendente; nova tentativa no próximo ciclo.', String(pedido._id)); }
  }));
  return { consultados, falhas };
}
function iniciarConciliacaoPagamentos() {
  let executando = false, encerrado = false;
  const executar = async () => {
    if (executando || encerrado) return;
    executando = true;
    try { await conciliarPedidos(); }
    catch { console.error('Não foi possível consultar os pedidos para conciliação; nova tentativa no próximo ciclo.'); }
    finally { executando = false; }
  };
  const timer = setInterval(executar, 30000); timer.unref();
  void executar();
  return () => { encerrado = true; clearInterval(timer); };
}
module.exports = { conciliarPedidos, iniciarConciliacaoPagamentos };
