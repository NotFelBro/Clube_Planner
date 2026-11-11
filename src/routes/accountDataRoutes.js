const express = require("express");
const { rateLimit } = require("express-rate-limit");
const User = require("../models/User");
const { autenticar } = require("../middlewares/authMiddleware");
const { validarOrigem } = require("../middlewares/validarOrigem");
const { adicionarEndereco } = require("../services/addressService");
const { AuthError } = require("../services/authService");
const router = express.Router();
const limitar = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
router.use(autenticar);
router.get("/addresses", async (req, res, next) => {
  try {
    const usuario = await User.findById(req.auth.userId).select("enderecos").lean();
    res.json({ success: true, data: { enderecos: usuario.enderecos } });
  } catch (erro) { next(erro); }
});
router.post("/addresses", validarOrigem, limitar, async (req, res, next) => {
  try {
    const dados = req.body;
    for (const campo of ["pais", "estado", "cep", "cidade", "bairro", "logradouro", "numero", "complemento"]) {
      if (dados?.[campo] !== undefined && (typeof dados[campo] !== "string" || dados[campo].length > 200)) throw new AuthError("Dados do endereço inválidos.");
    }
    if (dados?.pais !== "Brasil") throw new AuthError("O cadastro de endereços está disponível para o Brasil.");
    const enderecos = await adicionarEndereco(req.auth.userId, dados).catch((erro) => {
      if (erro.name === "ValidationError" || /Campo|Dados do endereço/.test(erro.message)) throw new AuthError("Preencha os campos obrigatórios e informe CEP e UF válidos.");
      throw erro;
    });
    res.status(201).json({ success: true, data: { enderecos } });
  } catch (erro) { next(erro); }
});
module.exports = router;
