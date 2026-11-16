const { rateLimit } = require('express-rate-limit');
const { autenticar, autorizarRoles } = require('./authMiddleware');
const { AuthError } = require('../services/authService');
const autorizar = autorizarRoles('admin');
const limitar = rateLimit({ windowMs: 60000, limit: process.env.NODE_ENV === 'test' ? 1000 : 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Muitas solicitações administrativas. Aguarde um minuto.' } });
function protegerAdmin(req, res, next) {
  if (req.adminAutorizado) return next();
  return autenticar(req, res, error => {
    if (error) return next(error);
    autorizar(req, res, error => {
      if (error) return next(error);
      limitar(req, res, error => {
        if (error) return next(error);
        req.adminAutorizado = true;
        next();
      });
    });
  });
}
function criarExecutorAdmin(maximo = 4) {
  let ativos = 0;
  return async function executar(operacao) {
    if (ativos >= maximo) throw new AuthError('O painel está processando outras operações. Aguarde um instante e atualize os dados antes de tentar novamente.', 429);
    ativos++;
    try { return await operacao(); }
    finally { ativos--; }
  };
}
const executarAdmin = criarExecutorAdmin();
module.exports = { protegerAdmin, executarAdmin, criarExecutorAdmin };
