
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  cadastro,
  login,
  refresh,
  logout,
  me,
  atualizarMeuPerfil,
  enviarLinkEmail,
  verificarEmail,
} = require("../controllers/authController");

const {
  autenticar,
} = require("../middlewares/authMiddleware");

const {
  validarOrigem,
} = require("../middlewares/validarOrigem");

const router = express.Router();
const { criarLimitadorLogin } = require("../middlewares/security");
const limitarConta = criarLimitadorLogin(process.env.NODE_ENV === "test" ? 1000 : 10);

function criarLimitador(limite, mensagem) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit:
      process.env.NODE_ENV === "test"
        ? 1000
        : limite,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: mensagem,
    },
  });
}

const limitarAutenticacao = criarLimitador(
  20,
  "Muitas tentativas. Tente novamente mais tarde."
);

const limitarRenovacao = criarLimitador(
  60,
  "Muitas tentativas de renovação. Aguarde alguns minutos."
);

const limitarAtualizacao = criarLimitador(
  30,
  "Muitas tentativas de atualização. Aguarde alguns minutos."
);

const limitarEnvioLink = criarLimitador(
  5,
  "Muitas solicitações de link. Aguarde alguns minutos."
);

const limitarVerificacao = criarLimitador(
  15,
  "Muitas tentativas de verificação. Aguarde alguns minutos."
);

router.post(
  "/register",
  validarOrigem,
  limitarAutenticacao,
  cadastro
);

router.post(
  "/login",
  validarOrigem,
  limitarAutenticacao,
  limitarConta,
  login
);

router.post(
  "/refresh",
  validarOrigem,
  limitarRenovacao,
  refresh
);

router.post(
  "/logout",
  validarOrigem,
  logout
);

router.get(
  "/me",
  autenticar,
  me
);

router.patch(
  "/me",
  validarOrigem,
  autenticar,
  limitarAtualizacao,
  atualizarMeuPerfil
);

router.post(
  "/send-verification",
  validarOrigem,
  limitarEnvioLink,
  enviarLinkEmail
);

router.post(
  "/verify-email",
  validarOrigem,
  limitarVerificacao,
  verificarEmail
);

const {
  listarSessoes,
} = require("../controllers/accountSecurityController");

router.get(
  "/sessions",
  autenticar,
  listarSessoes
);

const passwordReset = require("../services/passwordResetService");
const executarSenha = fn => async (req, res, next) => {
  try { res.json({ success: true, data: await fn(req.body) }); } catch (erro) { next(erro); }
};
router.post("/forgot-password", validarOrigem, limitarEnvioLink, executarSenha(dados => passwordReset.solicitarRecuperacao(dados?.email)));
router.post("/reset-password", validarOrigem, limitarVerificacao, executarSenha(dados => passwordReset.redefinirSenha(dados)));

const emailChange = require('../services/emailChangeService');
router.post('/me/email-change', validarOrigem, autenticar, limitarEnvioLink, async (req, res, next) => { try { res.json({ success: true, data: await emailChange.solicitar(req.auth.userId, req.body) }); } catch (error) { next(error); } });
router.delete('/me/email-change', validarOrigem, autenticar, limitarAtualizacao, async (req, res, next) => {
  try { res.json({ success: true, data: await emailChange.cancelar(req.auth.userId) }); } catch (error) { next(error); }
});
router.post('/confirm-email-change', validarOrigem, limitarVerificacao, executarSenha(dados => emailChange.confirmar(dados?.token)));
module.exports = router;
