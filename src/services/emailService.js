
const nodemailer = require("nodemailer");

function criarTransportador() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Configuração SMTP incompleta. Verifique o arquivo .env."
    );
  }

  const porta = Number(SMTP_PORT);

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("Porta SMTP inválida.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function enviarCodigoVerificacao(email, codigo) {
  if (
    typeof codigo !== "string" ||
    !/^\d{6}$/.test(codigo)
  ) {
    throw new Error("Código de verificação inválido.");
  }

  const transportador = criarTransportador();

  await transportador.sendMail({
    from: {
      name: "Clube Planner",
      address: process.env.SMTP_USER,
    },
    to: email,
    subject: "Clube Planner - Verificação de e-mail",
    text: [
      "Olá!",
      "",
      "Seu código de verificação do Clube Planner é:",
      "",
      codigo,
      "",
      "Este código expira em 10 minutos.",
      "",
      "Se você não solicitou este código, ignore esta mensagem.",
      "",
      "Equipe Clube Planner",
    ].join("\n"),
  });
}

module.exports = {
  criarTransportador,
  enviarCodigoVerificacao,
};
