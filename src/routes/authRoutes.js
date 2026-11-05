
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  cadastro,
  login,
} = require("../controllers/authController");

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

router.post(
  "/register",
  limitarAutenticacao,
  cadastro
);

router.post(
  "/login",
  limitarAutenticacao,
  login
);

module.exports = router;
