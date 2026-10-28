
const mongoose = require("mongoose");

const User = require("../models/User");
const Session = require("../models/session");

const {
  emitirAccessToken,
  gerarRefreshToken,
  calcularHashRefreshToken,
} = require("./authTokenService");

function obterDuracaoRefreshToken() {
  const valor = process.env.REFRESH_TOKEN_EXPIRES_DAYS;

  if (
    typeof valor !== "string" ||
    !/^[1-9]\d*$/.test(valor)
  ) {
    throw new Error(
      "REFRESH_TOKEN_EXPIRES_DAYS inválido."
    );
  }

  const dias = Number(valor);

  if (!Number.isSafeInteger(dias) || dias > 30) {
    throw new Error(
      "REFRESH_TOKEN_EXPIRES_DAYS deve estar entre 1 e 30."
    );
  }

  return dias * 24 * 60 * 60 * 1000;
}

async function criarSessao({ userId }) {
  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw new Error("Identificador de usuário inválido.");
  }

  const duracaoMs = obterDuracaoRefreshToken();

  const usuario = await User.findOne({
    _id: userId,
    ativo: true,
  })
    .select("_id")
    .lean();

  if (!usuario) {
    throw new Error("Usuário inexistente ou inativo.");
  }

  const refreshToken = gerarRefreshToken();
  const refreshTokenHash =
    calcularHashRefreshToken(refreshToken);

  const sessionId = new mongoose.Types.ObjectId();
  const familyId = new mongoose.Types.ObjectId();

  const accessToken = emitirAccessToken({
    userId: usuario._id,
    sessionId,
  });

  const expiresAt = new Date(Date.now() + duracaoMs);

  await Session.create({
    _id: sessionId,
    userId: usuario._id,
    familyId,
    refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    sessionId: String(sessionId),
    expiresAt,
  };
}

module.exports = {
  criarSessao,
};
