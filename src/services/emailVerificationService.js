
const crypto = require("node:crypto");

const User = require("../models/User");

const emailService = require("./emailService");

const VALIDADE_MS = 10 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;
const MAX_TENTATIVAS = 5;

const MENSAGEM_ENVIO =
  "Se houver uma conta cadastrada e elegível, enviaremos um código de acesso.";

class EmailVerificationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);

    this.name = "EmailVerificationError";
    this.statusCode = statusCode;
  }
}

function normalizarEmail(email) {
  if (typeof email !== "string") {
    throw new EmailVerificationError(
      "E-mail inválido."
    );
  }

  const normalizado = email.trim().toLowerCase();

  if (
    normalizado.length < 5 ||
    normalizado.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizado
    )
  ) {
    throw new EmailVerificationError(
      "E-mail inválido."
    );
  }

  return normalizado;
}

function obterChaveSecreta() {
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

function gerarCodigo() {
  return String(
    crypto.randomInt(0, 1_000_000)
  ).padStart(6, "0");
}

function calcularHash(codigo, salt) {
  return crypto
    .createHmac(
      "sha256",
      obterChaveSecreta()
    )
    .update(`${salt}:${codigo}`, "utf8")
    .digest("hex");
}

function gerarHash(codigo) {
  const salt = crypto
    .randomBytes(16)
    .toString("hex");

  return `${salt}:${calcularHash(codigo, salt)}`;
}

function compararCodigo(codigo, hashArmazenado) {
  if (
    typeof codigo !== "string" ||
    !/^\d{6}$/.test(codigo) ||
    typeof hashArmazenado !== "string"
  ) {
    return false;
  }

  const partes = hashArmazenado.split(":");

  if (partes.length !== 2) {
    return false;
  }

  const [salt, hashHex] = partes;

  if (
    !/^[a-f0-9]{32}$/i.test(salt) ||
    !/^[a-f0-9]{64}$/i.test(hashHex)
  ) {
    return false;
  }

  const recebido = Buffer.from(
    calcularHash(codigo, salt),
    "hex"
  );

  const esperado = Buffer.from(
    hashHex,
    "hex"
  );

  return crypto.timingSafeEqual(
    recebido,
    esperado
  );
}

async function solicitarCodigo(emailInformado) {
  const email = normalizarEmail(
    emailInformado
  );

  // Validar configuração antes de alterar
  // qualquer informação do usuário.
  obterChaveSecreta();

  const agora = new Date();
  const codigo = gerarCodigo();
  const codigoHash = gerarHash(codigo);

  const novoEstado = {
    codigoHash,
    expiraEm: new Date(
      agora.getTime() + VALIDADE_MS
    ),
    ultimoEnvioEm: agora,
    tentativas: 0,
  };

  // Retorna o estado ANTERIOR para permitir
  // recuperação em caso de falha no SMTP.
  const usuarioAnterior =
    await User.findOneAndUpdate(
      {
        email,
        ativo: true,
        emailVerificado: false,

        $or: [
          {
            "verificacaoEmail.ultimoEnvioEm":
              null,
          },
          {
            "verificacaoEmail.ultimoEnvioEm": {
              $lte: new Date(
                agora.getTime() -
                  INTERVALO_REENVIO_MS
              ),
            },
          },
        ],
      },
      {
        $set: {
          "verificacaoEmail.codigoHash":
            novoEstado.codigoHash,
          "verificacaoEmail.expiraEm":
            novoEstado.expiraEm,
          "verificacaoEmail.ultimoEnvioEm":
            novoEstado.ultimoEnvioEm,
          "verificacaoEmail.tentativas": 0,
        },
      },
      {
        new: false,
      }
    ).select(
      "+verificacaoEmail.codigoHash " +
      "+verificacaoEmail.expiraEm " +
      "+verificacaoEmail.ultimoEnvioEm " +
      "+verificacaoEmail.tentativas"
    );

  if (!usuarioAnterior) {
    return {
      mensagem: MENSAGEM_ENVIO,
    };
  }

  try {
    await emailService.enviarCodigoVerificacao(
      email,
      codigo
    );
  } catch (erro) {
    // Só restaurar se o código ainda for
    // exatamente aquele que tentamos enviar.
    // Isso evita sobrescrever outro reenvio
    // ou uma confirmação concorrente.
    const anterior =
      usuarioAnterior.verificacaoEmail;

    const restauracao = {
      "verificacaoEmail.codigoHash":
        anterior?.codigoHash ?? null,

      "verificacaoEmail.expiraEm":
        anterior?.expiraEm ?? null,

      "verificacaoEmail.ultimoEnvioEm":
        anterior?.ultimoEnvioEm ?? null,

      "verificacaoEmail.tentativas":
        anterior?.tentativas ?? 0,
    };

    try {
      await User.updateOne(
        {
          _id: usuarioAnterior._id,
          ativo: true,
        emailVerificado: false,

          "verificacaoEmail.codigoHash":
            codigoHash,
          "verificacaoEmail.tentativas": 0,
        },
        {
          $set: restauracao,
        }
      );
    } catch (erroRestauracao) {
      console.error(
        "Falha ao restaurar estado de verificação:",
        erroRestauracao.code ||
          erroRestauracao.message
      );
    }

    console.error(
      "Falha ao enviar código de verificação:",
      erro.code || erro.message
    );

    throw new EmailVerificationError(
      "Não foi possível enviar o código. Tente novamente mais tarde.",
      503
    );
  }

  return {
    mensagem: MENSAGEM_ENVIO,
  };
}

async function confirmarCodigo(
  emailInformado,
  codigo
) {
  const email = normalizarEmail(
    emailInformado
  );

  if (
    typeof codigo !== "string" ||
    !/^\d{6}$/.test(codigo)
  ) {
    throw new EmailVerificationError(
      "Código inválido."
    );
  }

  obterChaveSecreta();

  const usuario = await User.findOne({
    email,
    ativo: true,
        emailVerificado: false,

  }).select(
    "+verificacaoEmail.codigoHash " +
    "+verificacaoEmail.expiraEm " +
    "+verificacaoEmail.tentativas"
  );

  if (!usuario) {
    throw new EmailVerificationError(
      "Código inválido ou expirado."
    );
  }

  const verificacao =
    usuario.verificacaoEmail;

  const agora = new Date();

  if (
    !verificacao?.codigoHash ||
    !verificacao?.expiraEm ||
    verificacao.expiraEm <= agora
  ) {
    throw new EmailVerificationError(
      "Código inválido ou expirado."
    );
  }

  const tentativasAnteriores =
    verificacao.tentativas ?? 0;

  if (
    tentativasAnteriores >= MAX_TENTATIVAS
  ) {
    throw new EmailVerificationError(
      "Limite de tentativas atingido. Solicite outro código.",
      429
    );
  }

  const codigoCorreto = compararCodigo(
    codigo,
    verificacao.codigoHash
  );

  // Reservar uma tentativa com comparação
  // do contador anterior (controle CAS).
  // Duas requisições não podem reservar
  // a mesma tentativa.
  const reserva =
    await User.findOneAndUpdate(
      {
        _id: usuario._id,
        ativo: true,
        emailVerificado: false,

        "verificacaoEmail.codigoHash":
          verificacao.codigoHash,
        "verificacaoEmail.expiraEm": {
          $gt: new Date(),
        },
        "verificacaoEmail.tentativas":
          tentativasAnteriores,
      },
      {
        $inc: {
          "verificacaoEmail.tentativas": 1,
        },
      },
      {
        new: true,
      }
    );

  if (!reserva) {
    throw new EmailVerificationError(
      "O código foi alterado ou houve outra tentativa simultânea. Tente novamente.",
      409
    );
  }

  if (!codigoCorreto) {
    throw new EmailVerificationError(
      "Código inválido."
    );
  }

  // A confirmação só ocorre se nenhuma
  // outra tentativa ou reenvio alterou
  // o estado desde a reserva.
  const confirmado =
    await User.findOneAndUpdate(
      {
        _id: usuario._id,
        ativo: true,
        emailVerificado: false,

        "verificacaoEmail.codigoHash":
          verificacao.codigoHash,
        "verificacaoEmail.expiraEm": {
          $gt: new Date(),
        },
        "verificacaoEmail.tentativas":
          tentativasAnteriores + 1,
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

  if (!confirmado) {
    throw new EmailVerificationError(
      "Não foi possível confirmar o código. Tente novamente.",
      409
    );
  }

  return {
    mensagem:
      "E-mail verificado com sucesso.",
  };
}

module.exports = {
  EmailVerificationError,
  solicitarCodigo,
  confirmarCodigo,
};
