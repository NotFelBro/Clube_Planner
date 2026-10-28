
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const ALGORITMO = "HS256";
const EMISSOR = "clube-planner-api";
const AUDIENCIA = "clube-planner-client";

function obterConfiguracaoJWT() {
  const segredo = process.env.JWT_ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN;

  if (
    typeof segredo !== "string" ||
    segredo.length < 64 ||
    segredo === "substitua_por_um_segredo_aleatorio_seguro"
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET ausente ou inseguro."
    );
  }

  if (
    typeof expiresIn !== "string" ||
    !/^[1-9]\d*[smhd]$/.test(expiresIn)
  ) {
    throw new Error(
      "JWT_ACCESS_EXPIRES_IN inválido."
    );
  }

  return { segredo, expiresIn };
}

function emitirAccessToken({ userId, sessionId }) {
  if (
    !mongoose.isObjectIdOrHexString(userId) ||
    !mongoose.isObjectIdOrHexString(sessionId)
  ) {
    throw new Error(
      "Identificadores de autenticação inválidos."
    );
  }

  const { segredo, expiresIn } = obterConfiguracaoJWT();

  return jwt.sign(
    {
      tokenUse: "access",
      sid: String(sessionId),
    },
    segredo,
    {
      algorithm: ALGORITMO,
      expiresIn,
      issuer: EMISSOR,
      audience: AUDIENCIA,
      subject: String(userId),
    }
  );
}

function verificarAccessToken(token) {
  if (
    typeof token !== "string" ||
    token.length === 0
  ) {
    throw new Error("Access token inválido.");
  }

  const { segredo } = obterConfiguracaoJWT();

  const payload = jwt.verify(token, segredo, {
    algorithms: [ALGORITMO],
    issuer: EMISSOR,
    audience: AUDIENCIA,
  });

  if (
    typeof payload !== "object" ||
    payload.tokenUse !== "access" ||
    !mongoose.isObjectIdOrHexString(payload.sub) ||
    !mongoose.isObjectIdOrHexString(payload.sid)
  ) {
    throw new Error("Access token inválido.");
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
  };
}

function gerarRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function calcularHashRefreshToken(refreshToken) {
  if (
    typeof refreshToken !== "string" ||
    !/^[a-f0-9]{96}$/.test(refreshToken)
  ) {
    throw new Error("Refresh token inválido.");
  }

  return crypto
    .createHash("sha256")
    .update(refreshToken, "utf8")
    .digest("hex");
}

module.exports = {
  emitirAccessToken,
  verificarAccessToken,
  gerarRefreshToken,
  calcularHashRefreshToken,
};
