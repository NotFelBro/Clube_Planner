const express = require('express');
const helmet = require('helmet');
const crypto = require('node:crypto');
const { configurarTransporte } = require('./config/transport');
const { contextoRequisicao } = require('./middlewares/security');

const CAMINHO_MANUTENCAO = '/api/v1/internal/maintenance';

function criarHandler({
  app = require('./app'),
  inicializar = require('./config/bootstrap').inicializarAplicacao,
  expirar = require('./services/reservationExpiryService').expirarReservas,
  conciliar = require('./services/paymentReconciliationService').conciliarPedidos,
  env = process.env,
  agora = Date.now,
} = {}) {
  const handler = express();
  configurarTransporte(handler, env);
  handler.use(helmet());
  handler.use(contextoRequisicao);
  // Cache só durante a vida desta instância. Transações protegem a concorrência entre instâncias.
  let ultimaLimpeza = -Infinity;
  let limpezaPendente;
  async function limpar() {
    if (limpezaPendente) return limpezaPendente;
    limpezaPendente = expirar().then(resultado => {
      ultimaLimpeza = agora();
      return resultado;
    }).finally(() => { limpezaPendente = undefined; });
    return limpezaPendente;
  }
  function autorizado(req) {
    if (typeof env.CRON_SECRET !== 'string' || env.CRON_SECRET.length < 32) return false;
    const digest = valor => crypto.createHash('sha256').update(valor).digest();
    return crypto.timingSafeEqual(digest(req.get('Authorization') || ''), digest(`Bearer ${env.CRON_SECRET}`));
  }
  // Autenticar ANTES de abrir uma conexão com o banco.
  handler.get(CAMINHO_MANUTENCAO, async (req, res, next) => {
    if (!autorizado(req)) return res.status(401).json({ success: false, message: 'Não autorizado.' });
    try {
      await inicializar();
      const expirados = await limpar();
      const pagamentos = await conciliar({ limite: 10 });
      res.json({ success: true, data: { expirados, pagamentos } });
    } catch (error) { next(error); }
  });
  handler.all(CAMINHO_MANUTENCAO, (req, res) => res.status(405).set('Allow', 'GET').json({ success: false }));
  handler.use(async (req, res, next) => {
    try {
      await inicializar();
      // No Hobby não há timers persistentes. Fazer a limpeza enquanto a loja é usada.
      if (agora() - ultimaLimpeza >= 60000 &&
          ((req.method === 'GET' && req.path === '/api/v1/shop/catalog') ||
           (req.method === 'POST' && req.path === '/api/v1/shop/checkout'))) await limpar();
      next();
    } catch (error) { next(error); }
  });
  handler.use(app);
  handler.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(JSON.stringify({ evento: 'falha_serverless', tipo: error.name || 'Error', requestId: req.requestId }));
    res.status(503).json({ success: false, message: 'Serviço temporariamente indisponível.', requestId: req.requestId });
  });
  return handler;
}

module.exports = { criarHandler };
