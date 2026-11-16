const express = require('express');
const mongoose = require('mongoose');
const { protegerAdmin, executarAdmin } = require('../middlewares/adminProtection');
const {
  validarOrigem
} = require('../middlewares/validarOrigem');
const service = require('../services/adminService');
const settings = require('../services/storeSettingsService');
const orders = require('../services/storeOrderService');
const shipping = require('../../shared/shippingRules.json');
const router = express.Router();
const executar = fn => async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await executarAdmin(() => fn(req))
    });
  } catch (e) {
    next(e);
  }
};
router.use(protegerAdmin);
router.get('/overview', executar(req => service.resumo(req.query)));
router.get('/reports', executar(req => service.resumo(req.query)));
router.get('/orders', executar(req => service.listarPedidos(req.query)));
router.get('/orders/:id', executar(req => service.detalhePedido(req.params.id)));
router.get('/payments', executar(req => service.listarPagamentos(req.query)));
router.get('/customers', executar(req => service.listarClientes(req.query)));
router.get('/settings', executar(async () => ({
  loja: await settings.configuracao(),
  frete: shipping,
  historico: await require('../models/adminEvent').find({
    entidadeId: 'loja'
  }).sort({
    createdAt: -1
  }).limit(30).select('acao descricao createdAt').maxTimeMS(5000).lean(),
  pagamento: {
    ...require('../services/sampleCatalogService').configuracao(),
    credenciaisConfiguradas: Boolean(process.env.MP_ACCESS_TOKEN),
    webhookConfigurado: Boolean(process.env.MP_WEBHOOK_SECRET && process.env.MP_WEBHOOK_URL)
  }
})));
router.use((req, res, next) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? validarOrigem(req, res, next) : next());
router.patch('/orders/:id/status', executar(req => service.alterarPedido(req.params.id, req.body, req.auth.userId)));
router.post('/orders/:id/sync', executar(async req => {
  const detalhe = await service.detalhePedido(req.params.id);
  await orders.sincronizar(detalhe.pedido.cliente?._id || (await require('../models/order').findById(req.params.id).select('userId')).userId, req.params.id);
  await service.registrar(req.auth.userId, 'pedido.conciliacao', req.params.id, 'Pagamento consultado no Mercado Pago');
  return service.detalhePedido(req.params.id);
}));
router.post('/orders/:id/cancel', executar(async req => {
  const pedido = await require('../models/order').findById(req.params.id);
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado.'), {
    statusCode: 404
  });
  await orders.cancelarPedido(String(pedido.userId), req.params.id);
  await service.registrar(req.auth.userId, 'pedido.cancelamento', req.params.id, 'Cancelamento solicitado pela administração');
  return service.detalhePedido(req.params.id);
}));
router.post('/orders/:id/stock-return', executar(req => service.registrarDevolucaoEstoque(req.params.id, req.auth.userId)));
router.patch('/customers/:id', executar(req => service.alterarCliente(req.params.id, req.body, req.auth.userId)));
router.put('/settings', executar(async req => {
  const loja = await mongoose.connection.transaction(async session => {
    const registro = await settings.salvar(req.body, session);
    await service.registrar(req.auth.userId, 'loja.configuracao', 'loja', 'Dados públicos e limite de estoque atualizados', session);
    return registro;
  });
  return {
    loja
  };
}));
module.exports = router;
