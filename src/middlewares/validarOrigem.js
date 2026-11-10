
function validarOrigem(req, res, next) {
  const origemPermitida =
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  const origem = req.get("Origin");

  if (!origem || origem !== origemPermitida) {
    return res.status(403).json({
      success: false,
      message: "Origem da requisição não autorizada.",
    });
  }

  return next();
}

module.exports = {
  validarOrigem,
};
