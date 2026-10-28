
const mongoose = require("mongoose");

const User = require("../models/User");
const Session = require("../models/session");

const {
  verificarAccessToken,
} = require("../services/authTokenService");

function responderNaoAutorizado(res) {
  return res.status(401).json({
    success: false,
    message: "Autenticação necessária ou sessão inválida.",
  });
}

async function autenticar(req, res, next) {
  const authorization = req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !/^Bearer [^\s]+$/i.test(authorization)
  ) {
    return responderNaoAutorizado(res);
  }

  const token = authorization.slice(7);

  let dadosToken;

  try {
    dadosToken = verificarAccessToken(token);
  } catch {
    return responderNaoAutorizado(res);
  }

  const { userId, sessionId } = dadosToken;

  if (
    !mongoose.isObjectIdOrHexString(userId) ||
    !mongoose.isObjectIdOrHexString(sessionId)
  ) {
    return responderNaoAutorizado(res);
  }

  try {
    const agora = new Date();

    const sessao = await Session.findOne({
      _id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: agora },
    }).lean();

    if (!sessao) {
      return responderNaoAutorizado(res);
    }

    const usuario = await User.findOne({
      _id: userId,
      ativo: true,
    })
      .select("_id role")
      .lean();

    if (!usuario) {
      return responderNaoAutorizado(res);
    }

    req.auth = {
      userId: String(usuario._id),
      sessionId: String(sessao._id),
      role: usuario.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function autorizarRoles(...rolesPermitidas) {
  return function verificarPermissao(req, res, next) {
    if (!req.auth) {
      return responderNaoAutorizado(res);
    }

    if (!rolesPermitidas.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado.",
      });
    }

    return next();
  };
}

module.exports = {
  autenticar,
  autorizarRoles,
};
