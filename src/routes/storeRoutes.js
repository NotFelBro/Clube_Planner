const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { autenticar } = require("../middlewares/authMiddleware");
const { validarOrigem } = require("../middlewares/validarOrigem");
const { AuthError } = require("../services/authService");
const shipping = require("../services/shippingService");
const { aplicarCupomFrete } = require("../services/shippingCouponService");
const pedidos = require("../services/storeOrderService");
const mp = require("../services/mercadoPagoService");
const Order = require("../models/order");
const Review = require("../models/review");
const User = require("../models/User");
const router = express.Router();
const limitar = rateLimit({ windowMs: 60000, limit: process.env.NODE_ENV === "test" ? 1000 : 30, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Aguarde antes de tentar novamente." } });
const executar = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (erro) { next(erro); } };
router.get("/catalog", executar(async (req, res) => res.json({ success: true, data: await require("../services/catalogService").catalogo() })));
router.post("/mercado-pago/webhook", executar(async (req, res) => {
  const id = mp.validarAssinatura(req);
  const pagamento = await mp.consultarPagamento(id);
  await pedidos.aplicarPagamento(pagamento);
  res.json({ success: true });
}));
router.get("/products/:id/reviews", executar(async (req, res) => {
  const avaliacoes = await Review.find({ productId: Number(req.params.id) }).select("nome nota comentario ambienteTeste createdAt").sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: { avaliacoes } });
}));
router.use(autenticar);
router.post("/products/:id/reviews", validarOrigem, limitar, executar(async (req, res) => {
  const productId = Number(req.params.id);
  const { nota, comentario } = req.body || {};
  if (!Number.isInteger(nota) || nota < 1 || nota > 5 || typeof comentario !== "string" || !comentario.trim() || comentario.length > 1000) throw new AuthError("Informe uma nota de 1 a 5 e um comentário de até 1000 caracteres.");
  const compra = await Order.exists({ userId: req.auth.userId, ambienteTeste: true, status: { $in: ["pago", "em_preparacao", "enviado", "entregue"] }, "itens.lineId": `sample-${productId}` });
  if (!compra) throw new AuthError("Você precisa concluir uma compra deste produto para avaliar.", 403);
  const usuario = await User.findById(req.auth.userId).select("nome");
  await Review.findOneAndUpdate({ userId: req.auth.userId, productId }, { $set: { nota, comentario: comentario.trim(), nome: usuario.nome.split(" ")[0], ambienteTeste: true } }, { upsert: true, runValidators: true });
  res.json({ success: true });
}));
router.get("/orders", executar(async (req, res) => {
  const lista = await Order.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: { pedidos: lista.map(pedidos.publico) } });
}));
router.post('/orders/sync', validarOrigem, limitar, executar(async (req, res) => {
  const resultado = await require('../services/paymentReconciliationService').conciliarPedidos({ userId: req.auth.userId, limite: 5 });
  res.json({ success: true, data: resultado });
}));
router.get("/orders/:id", executar(async (req, res) => res.json({ success: true, data: { pedido: pedidos.publico(await pedidos.obterPedido(req.auth.userId, req.params.id)) } })));
router.post("/shipping-quote", validarOrigem, limitar, executar(async (req, res) => {
  const produtos = (await require("../services/catalogService").catalogo()).produtos;
  res.json({ success: true, data: { frete: aplicarCupomFrete(await shipping.cotarFrete(req.body?.cep), req.body?.itens, req.body?.cupomFrete, produtos) } });
}));
router.post("/checkout", validarOrigem, limitar, executar(async (req, res) => {
  const pedido = await pedidos.criarPedido(req.auth.userId, req.body);
  res.status(201).json({ success: true, data: { pedido: pedidos.publico(pedido) } });
}));
router.post("/orders/:id/cancel", validarOrigem, limitar, executar(async (req, res) => res.json({ success: true, data: { pedido: pedidos.publico(await pedidos.cancelarPedido(req.auth.userId, req.params.id)) } })));
router.post("/orders/:id/payment", validarOrigem, limitar, executar(async (req, res) => res.json({ success: true, data: { pedido: pedidos.publico(await pedidos.iniciarPagamento(req.auth.userId, req.params.id)) } })));
router.post("/orders/:id/sync", validarOrigem, limitar, executar(async (req, res) => res.json({ success: true, data: { pedido: pedidos.publico(await pedidos.sincronizar(req.auth.userId, req.params.id)) } })));
module.exports = router;
