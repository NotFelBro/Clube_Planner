
const mongoose = require("mongoose");

const User = require("../models/User");
const Session = require("../models/session");

const {
  emitirAccessToken,
  gerarRefreshToken,
  calcularHashRefreshToken,
} = require("./authTokenService");

class SessionError extends Error {
  constructor(
    message = "Sessão inválida ou expirada.",
    statusCode = 401
  ) {
    super(message);
    this.name = "SessionError";
    this.statusCode = statusCode;
  }
}

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

function validarRefreshToken(refreshToken) {
  try {
    return calcularHashRefreshToken(refreshToken);
  } catch {
    throw new SessionError();
  }
}

async function criarSessao({ userId, userAgent = "" }) {
  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw new Error(
      "Identificador de usuário inválido."
    );
  }

  const duracaoMs = obterDuracaoRefreshToken();

  const usuario = await User.findOne({
    _id: userId,
    ativo: true,
  })
    .select("_id")
    .lean();

  if (!usuario) {
    throw new Error(
      "Usuário inexistente ou inativo."
    );
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

  const expiresAt = new Date(
    Date.now() + duracaoMs
  );

  await Session.create({
    _id: sessionId,
    userId: usuario._id,
    familyId,
    userAgent: String(userAgent).slice(0, 512),
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

async function renovarSessao({ refreshToken }) {
  const refreshTokenHash =
    validarRefreshToken(refreshToken);

  const duracaoMs = obterDuracaoRefreshToken();

  const transacao = await mongoose.startSession();

  let resultado;

  try {
    await transacao.withTransaction(async () => {
      const agora = new Date();

      const sessaoAtual = await Session.findOne({
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { $gt: agora },
      })
        .select("+refreshTokenHash")
        .session(transacao);

      if (!sessaoAtual) {
        throw new SessionError();
      }

      const usuario = await User.findOne({
        _id: sessaoAtual.userId,
        ativo: true,
      })
        .select("_id")
        .session(transacao);

      if (!usuario) {
        throw new SessionError();
      }

      const novoRefreshToken =
        gerarRefreshToken();

      const novoRefreshTokenHash =
        calcularHashRefreshToken(
          novoRefreshToken
        );

      const novaSessionId =
        new mongoose.Types.ObjectId();

      const expiresAt = new Date(
        Date.now() + duracaoMs
      );

      const accessToken = emitirAccessToken({
        userId: usuario._id,
        sessionId: novaSessionId,
      });

      const atualizacao =
        await Session.updateOne(
          {
            _id: sessaoAtual._id,
            refreshTokenHash,
            revokedAt: null,
            expiresAt: { $gt: agora },
          },
          {
            $set: {
              revokedAt: agora,
              revokeReason: "rotation",
              lastUsedAt: agora,
            },
          },
          { session: transacao }
        );

      if (atualizacao.modifiedCount !== 1) {
        throw new SessionError();
      }

      await Session.create(
        [
          {
            _id: novaSessionId,
            userId: usuario._id,
            familyId: sessaoAtual.familyId,
            userAgent: sessaoAtual.userAgent,
            lastUsedAt: agora,
            refreshTokenHash:
              novoRefreshTokenHash,
            expiresAt,
          },
        ],
        { session: transacao }
      );

      resultado = {
  userId: String(usuario._id),
  accessToken,
  refreshToken: novoRefreshToken,
  sessionId: String(novaSessionId),
  expiresAt,
};
    });

    return resultado;
  } catch (erro) {
    if (
      erro instanceof SessionError ||
      erro?.code === 112 ||
      erro?.hasErrorLabel?.(
        "TransientTransactionError"
      )
    ) {
      throw new SessionError();
    }

    throw erro;
  } finally {
    await transacao.endSession();
  }
}

async function encerrarSessao({ refreshToken }) {
  const refreshTokenHash =
    validarRefreshToken(refreshToken);

  const agora = new Date();

  const resultado = await Session.updateOne(
    {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: { $gt: agora },
    },
    {
      $set: {
        revokedAt: agora,
        revokeReason: "logout",
        lastUsedAt: agora,
      },
    }
  );

  return resultado.modifiedCount === 1;
}

module.exports = {
  SessionError,
  criarSessao,
  renovarSessao,
  encerrarSessao,
};
