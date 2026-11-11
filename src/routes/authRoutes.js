
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  cadastro,
  login,
  refresh,
  logout,
  me,
  atualizarMeuPerfil,
  enviarCodigoEmail,
  verificarEmail,
} = require("../controllers/authController");

const {
  autenticar,
} = require("../middlewares/authMiddleware");

const {
  validarOrigem,
} = require("../middlewares/validarOrigem");

const router = express.Router();

const limitarAutenticacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Muitas tentativas. Tente novamente mais tarde.",
  },
});

const limitarRenovacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Muitas tentativas de renovação. Aguarde alguns minutos.",
  },
});

const limitarAtualizacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Muitas tentativas de atualização. Aguarde alguns minutos.",
  },
});

const limitarEnvioCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Muitas solicitações de código. Aguarde alguns minutos.",
  },
});

const limitarVerificacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Muitas tentativas de verificação. Aguarde alguns minutos.",
  },
});

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
  limitarEnvioCodigo,
  enviarCodigoEmail
);

router.post(
  "/verify-email",
  validarOrigem,
  limitarVerificacao,
  verificarEmail
);

const { listarSessoes } = require("../controllers/accountSecurityController");
router.get("/sessions", autenticar, listarSessoes);

module.exports = router;
