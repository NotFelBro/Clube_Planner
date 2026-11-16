
const crypto = require("node:crypto");
const User = require("../models/User");
const emailService = require("./emailService");

const VALIDADE_MS = 10 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;

const MENSAGEM_ENVIO =
  "Se houver uma conta pendente elegível, enviaremos um link de verificação.";

class EmailVerificationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "EmailVerificationError";
    this.statusCode = statusCode;
  }
}

function normalizarEmail(valor) {
  if (
    typeof valor !== "string" ||
    valor.trim().length < 5 ||
    valor.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
  ) {
    throw new EmailVerificationError("E-mail inválido.");
  }

  return valor.trim().toLowerCase();
}

function obterSegredo() {
  const segredo = process.env.EMAIL_CODE_SECRET;

  if (
    typeof segredo !== "string" ||
    Buffer.byteLength(segredo, "utf8") < 32
  ) {
    throw new Error(
      "EMAIL_CODE_SECRET deve conter pelo menos 32 bytes."
    );
  }

  return segredo;
}

function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto
    .createHmac("sha256", obterSegredo())
    .update(token)
    .digest("hex");
}

function criarUrlVerificacao(token) {
  const origem =
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  const url = new URL("/confirmar-email", origem);

  // Fragmentos não são enviados ao servidor web.
  url.hash = `token=${encodeURIComponent(token)}`;

  return url.toString();
}

async function solicitarLink(emailInformado) {
  const email = normalizarEmail(emailInformado);

  obterSegredo();

  const agora = new Date();
  const token = gerarToken();
  const tokenHash = hashToken(token);

  const estadoNovo = {
    codigoHash: tokenHash,
    expiraEm: new Date(agora.getTime() + VALIDADE_MS),
    ultimoEnvioEm: agora,
    tentativas: 0,
  };

  const usuarioAnterior = await User.findOneAndUpdate(
    {
      email,
      ativo: true,
      emailVerificado: false,
      $or: [
        { "verificacaoEmail.ultimoEnvioEm": null },
        {
          "verificacaoEmail.ultimoEnvioEm": {
            $lte: new Date(
              agora.getTime() - INTERVALO_REENVIO_MS
            ),
          },
        },
      ],
    },
    {
      $set: {
        "verificacaoEmail.codigoHash":
          estadoNovo.codigoHash,
        "verificacaoEmail.expiraEm":
          estadoNovo.expiraEm,
        "verificacaoEmail.ultimoEnvioEm":
          estadoNovo.ultimoEnvioEm,
        "verificacaoEmail.tentativas": 0,
      },
    },
    { new: false }
  ).select(
    "+verificacaoEmail.codigoHash " +
    "+verificacaoEmail.expiraEm " +
    "+verificacaoEmail.ultimoEnvioEm " +
    "+verificacaoEmail.tentativas"
  );

  if (!usuarioAnterior) {
    return { mensagem: MENSAGEM_ENVIO };
  }

  try {
    await emailService.enviarLinkVerificacao(
      email,
      criarUrlVerificacao(token)
    );
  } catch (erro) {
    const anterior = usuarioAnterior.verificacaoEmail;

    try {
      await User.updateOne(
        {
          _id: usuarioAnterior._id,
          ativo: true,
          emailVerificado: false,
          "verificacaoEmail.codigoHash": tokenHash,
        },
        {
          $set: {
            "verificacaoEmail.codigoHash":
              anterior?.codigoHash ?? null,
            "verificacaoEmail.expiraEm":
              anterior?.expiraEm ?? null,
            "verificacaoEmail.ultimoEnvioEm":
              anterior?.ultimoEnvioEm ?? null,
            "verificacaoEmail.tentativas":
              anterior?.tentativas ?? 0,
          },
        }
      );
    } catch (erroRestauracao) {
      console.error(
        "Falha ao restaurar verificação:",
        erroRestauracao.message
      );
    }

    console.error(
      "Falha no envio de verificação:",
      erro.code || erro.message
    );

    throw new EmailVerificationError(
      "Não foi possível enviar o link. Tente novamente mais tarde.",
      503
    );
  }

  return { mensagem: MENSAGEM_ENVIO };
}

async function confirmarLink(token) {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    throw new EmailVerificationError(
      "Link de verificação inválido ou expirado."
    );
  }

  const tokenHash = hashToken(token);

  // A confirmação é atômica: apenas uma requisição
  // consegue consumir o token válido.
  const usuario = await User.findOneAndUpdate(
    {
      ativo: true,
      emailVerificado: false,
      "verificacaoEmail.codigoHash": tokenHash,
      "verificacaoEmail.expiraEm": {
        $gt: new Date(),
      },
    },
    {
      $set: {
        emailVerificado: true,
        emailVerificadoEm: new Date(),
      },
      $unset: {
        verificacaoEmail: "",
      },
    },
    {
      new: true,
    }
  );

  if (!usuario) {
    throw new EmailVerificationError(
      "Este link é inválido, expirou ou já foi utilizado."
    );
  }

  return usuario;
}

module.exports = {
  EmailVerificationError,
  solicitarLink,
  confirmarLink,
};
