const nodemailer = require("nodemailer");

function criarTransportador() {
  // Nenhum teste automatizado pode usar as credenciais SMTP do ambiente local.
  if (process.env.NODE_ENV === "test") {
    throw new Error("Envio SMTP real bloqueado durante testes automatizados.");
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Configuração SMTP incompleta. Verifique o arquivo .env.");
  }
  const porta = Number(SMTP_PORT);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error("Porta SMTP inválida.");
  return nodemailer.createTransport({ host: SMTP_HOST, port: porta, secure: porta === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
  });
}

const escapar = valor => valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function criarMensagemLink(email, url, tipo) {
  const destino = new URL(url);
  const senha = tipo === "senha";
  const alteracao = tipo === "alteracao";
  if (!["senha", "verificacao", "alteracao"].includes(tipo) || !["https:", "http:"].includes(destino.protocol) || destino.pathname !== (senha ? "/redefinir-senha" : alteracao ? "/confirmar-alteracao-email" : "/confirmar-email") || !/^#token=[a-f0-9]{64}$/i.test(destino.hash)) {
    throw new Error("URL de verificação inválida.");
  }
  const titulo = alteracao ? "Confirme seu<br>novo e-mail." : senha ? "Uma nova senha.<br>Um novo começo." : "Seu próximo capítulo<br>começa aqui.";
  const assunto = alteracao ? "Confirme seu novo e-mail" : senha ? "Redefina sua senha" : "Confirme seu e-mail";
  const botao = alteracao ? "Confirmar novo e-mail" : senha ? "Redefinir minha senha" : "Verificar minha conta";
  const descricao = alteracao ? "Recebemos uma solicitação para alterar o e-mail da sua conta. Confirme este novo endereço pelo botão abaixo. Até a confirmação, o e-mail atual continuará sendo usado na loja." : senha ? "Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo e escolha sua nova senha." : "Falta só confirmar seu e-mail para ativar sua conta e aproveitar o Clube Planner. Suas ideias já têm um lugar especial por aqui.";
  const aviso = alteracao ? "Se você não solicitou esta alteração, ignore esta mensagem. O e-mail atual da conta permanece o mesmo." : senha ? "Se você não solicitou esta alteração, ignore esta mensagem. Sua senha continua a mesma." : "Se você não criou esta conta, ignore esta mensagem.";
  const link = escapar(destino.toString());
  return {
    from: { name: "Clube Planner", address: process.env.SMTP_USER }, to: email,
    subject: `Clube Planner | ${assunto}`,
    text: `${assunto}\n\n${descricao}\n\n${botao}:\n${destino.toString()}\n\nO link expira em 10 minutos e pode ser usado uma única vez.\n\n${aviso}\n\nClube Planner — Papelaria com afeto`,
    html: `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${assunto}</title></head>
<body style="margin:0;padding:0;background:#f4f1de;color:#3d405b;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${assunto} com segurança. Seu link é válido por 10 minutos.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1de;"><tr><td align="center" style="padding:36px 16px;">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="width:100%;max-width:540px;">
      <tr><td style="padding:0 8px 22px;text-align:center;"><span style="font-size:24px;font-weight:bold;letter-spacing:-1px;">clube planner<span style="color:#e47c62;">.</span></span><br><span style="font-size:10px;letter-spacing:3px;line-height:28px;">PAPELARIA COM AFETO</span></td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e6e2d4;border-radius:22px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:13px 24px;background:#3d405b;text-align:center;color:#f4f1de;font-size:10px;font-weight:bold;letter-spacing:2px;border-radius:21px 21px 0 0;">SEGURANÇA DA SUA CONTA</td></tr>
          <tr><td style="padding:36px 28px 30px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td width="64" height="64" style="background:#e8f1e8;border-radius:18px;text-align:center;color:#3d405b;font-size:24px;font-weight:bold;">${senha ? '&#128274;' : '&#9993;'}</td></tr></table>
            <h1 style="margin:24px 0 18px;font-size:30px;line-height:1.25;letter-spacing:-0.7px;color:#3d405b;">${titulo}</h1>
            <p style="margin:0;font-size:14px;line-height:1.8;color:#656779;">${descricao}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 22px;"><tr><td bgcolor="#e47c62" style="border-radius:11px;text-align:center;"><a href="${link}" style="display:inline-block;padding:17px 30px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;border:1px solid #e47c62;border-radius:11px;">${botao} &rarr;</a></td></tr></table>
            <p style="margin:0;display:inline-block;border-radius:8px;background:#f4f1de;padding:9px 14px;color:#3d405b;font-size:12px;">Válido por <strong>10 minutos</strong> &nbsp;·&nbsp; Uso único</p>
          </td></tr>
          <tr><td style="padding:0 28px 28px;">
            <div style="border-top:1px solid #e6e2d4;padding-top:20px;"><p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:#656779;">Se o botão não abrir, copie o link abaixo e cole no seu navegador:</p><a href="${link}" style="display:block;word-break:break-all;overflow-wrap:anywhere;font-size:11px;line-height:1.7;color:#656779;">${link}</a></div>
            <p style="margin:20px 0 0;padding:14px;background:#faf8f1;border-radius:10px;font-size:12px;line-height:1.7;color:#656779;">${aviso}</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:22px 20px 0;text-align:center;font-size:11px;line-height:1.8;color:#777888;">Clube Planner · Papelaria com afeto<br>Cuide dos seus planos. A gente cuida dos detalhes.</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  };
}
async function enviarLinkVerificacao(email, url) {
  const mensagem = criarMensagemLink(email, url, "verificacao");
  await criarTransportador().sendMail(mensagem);
}
async function enviarLinkSenha(email, url) {
  const mensagem = criarMensagemLink(email, url, "senha");
  await criarTransportador().sendMail(mensagem);
}
async function enviarLinkAlteracaoEmail(email, url) {
  await criarTransportador().sendMail(criarMensagemLink(email, url, "alteracao"));
}
module.exports = { enviarLinkAlteracaoEmail, criarTransportador, criarMensagemLink, enviarLinkVerificacao, enviarLinkSenha };
