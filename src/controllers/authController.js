
const {
  cadastrarUsuario,
  autenticarUsuario,
} = require("../services/authService");

function opcoesCookie(expiresAt) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    expires: expiresAt,
  };
}

async function cadastro(req, res, next) {
  try {
    const usuario = await cadastrarUsuario(
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Cadastro realizado com sucesso.",
      data: { usuario },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function login(req, res, next) {
  try {
    const resultado = await autenticarUsuario(
      req.body
    );

    const { usuario, sessao } = resultado;

    res.cookie(
      "refreshToken",
      sessao.refreshToken,
      opcoesCookie(sessao.expiresAt)
    );

    return res.status(200).json({
      success: true,
      message: "Login realizado com sucesso.",
      data: {
        usuario,
        accessToken: sessao.accessToken,
        expiresAt: sessao.expiresAt,
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  cadastro,
  login,
};
