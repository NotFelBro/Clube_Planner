const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');

function contextoRequisicao(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.set('X-Request-ID', req.requestId);
  res.set('Cache-Control', 'no-store');
  next();
}
function validarObjeto(valor, profundidade = 0, consulta = false) {
  if (!valor || typeof valor !== 'object') return;
  if (profundidade > 12) throw Object.assign(new Error('Dados excessivamente aninhados.'), { statusCode: 400 });
  for (const [chave, conteudo] of Object.entries(valor)) {
    if (chave.startsWith('$') || (chave.includes('.') && !(consulta && profundidade === 0 && chave === 'data.id')) || ['__proto__', 'prototype', 'constructor'].includes(chave)) {
      throw Object.assign(new Error('Os dados contêm campos não permitidos.'), { statusCode: 400 });
    }
    validarObjeto(conteudo, profundidade + 1);
  }
}
function validarEntrada(req, res, next) {
  if (req.body !== undefined && (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ success: false, message: 'Envie um objeto JSON válido.' });
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json') && (req.get('transfer-encoding') || Number(req.get('content-length')) > 0)) {
    return res.status(415).json({ success: false, message: 'Envie os dados no formato JSON.' });
  }
  try { validarObjeto(req.body); validarObjeto(req.query, 0, true); next(); } catch (error) { next(error); }
}
function criarLimitadorGlobal(limit = 300) {
  return rateLimit({ windowMs: 60000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, message: 'Muitas requisições. Aguarde um minuto e tente novamente.' },
  });
}
function criarLimitadorLogin(limit = 10) {
  return rateLimit({ windowMs: 15 * 60000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    // O identificador não aparece no armazenamento do limitador ou nos headers.
    keyGenerator: req => crypto.createHash('sha256').update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'invalido').digest('hex'),
    skipSuccessfulRequests: true,
    message: { success: false, message: 'Muitas tentativas de acesso a esta conta. Aguarde 15 minutos antes de tentar novamente.' },
  });
}
function tratarErro(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = 500;
  let message = 'Não foi possível concluir a operação. Tente novamente mais tarde.';
  if (err.type === 'entity.too.large') { status = 413; message = 'A requisição excedeu o tamanho permitido.'; }
  else if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') { status = 415; message = 'Formato ou compactação da requisição não suportado.'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'JSON inválido.'; }
  else if (err.type === 'request.aborted' || err.type === 'request.size.invalid') { status = 400; message = 'Requisição incompleta ou inválida.'; }
  else if (err.code === 11000) { status = 409; message = 'Já existe um cadastro com esses dados.'; }
  else if (['ValidationError', 'CastError', 'StrictModeError'].includes(err.name)) { status = 400; message = 'Dados inválidos. Revise os campos e tente novamente.'; }
  else if ([50, 262].includes(err.code) || err.codeName === 'MaxTimeMSExpired') { status = 503; message = 'A consulta demorou mais que o permitido. Reduza os filtros ou tente novamente em instantes.'; }
  else if (['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(err.name)) { status = 503; message = 'Serviço temporariamente indisponível. Tente novamente em instantes.'; }
  else if (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 500) { status = err.statusCode; message = err.message; }
  else if (err.statusCode === 503 && ['AuthError', 'EmailVerificationError'].includes(err.name)) { status = 503; message = err.message; }
  if (status >= 500) console.error(JSON.stringify({ evento: 'falha_requisicao', requestId: req.requestId, status, tipo: err.name || 'Error' }));
  res.status(status).json({ success: false, message, requestId: req.requestId });
}
module.exports = { contextoRequisicao, validarEntrada, criarLimitadorGlobal, criarLimitadorLogin, tratarErro };
