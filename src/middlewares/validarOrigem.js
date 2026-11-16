
function validarOrigem(req, res, next) {
  const origemPermitida =
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  let origemConfigurada;
  try { origemConfigurada = new URL(origemPermitida).origin; } catch { return next(new Error("Origem do frontend inválida.")); }
  const origem = req.get("Origin");

  if (!origem || origem !== origemConfigurada) {
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
