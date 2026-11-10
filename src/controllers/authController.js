const {
  cadastrarUsuario,
  autenticarUsuario,
  atualizarDadosPessoais,
} = require("../services/authService");

const {
  renovarSessao,
  encerrarSessao,
  SessionError,
} = require("../services/sessionService");

const {
  solicitarCodigo,
  confirmarCodigo,
} = require("../services/emailVerificationService");

const User = require("../models/User");

const CAMINHO_COOKIE = "/api/v1/auth";

function configuracaoCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CAMINHO_COOKIE,
  };
}

function opcoesCookie(expiresAt) {
  return {
    ...configuracaoCookie(),
    expires: expiresAt,
  };
}

function limparCookie(res) {
  res.clearCookie(
    "refreshToken",
    configuracaoCookie()
  );
}

function usuarioPublico(usuario) {
  return {
    id: String(usuario._id),
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  };
}

async function cadastro(req, res, next) {
  try {
    const usuario = await cadastrarUsuario(req.body);

    let codigoEnviado = false;

    try {
      await solicitarCodigo(usuario.email);
      codigoEnviado = true;
    } catch (erro) {
      if (erro.statusCode !== 503) {
        return next(erro);
      }

      console.error(
        "Falha no envio do código após cadastro:",
        erro.message
      );
    }

    return res.status(201).json({
      success: true,
      message: codigoEnviado
        ? "Cadastro realizado. Verifique seu e-mail para confirmar a conta."
        : "Cadastro realizado, mas não foi possível enviar o código. Solicite um novo código.",
      data: {
        usuario,
        codigoEnviado,
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function login(req, res, next) {
  try {
    const { usuario, sessao } =
      await autenticarUsuario(req.body);

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

async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (
      typeof refreshToken !== "string" ||
      !refreshToken
    ) {
      throw new SessionError();
    }

    const sessao = await renovarSessao({
      refreshToken,
    });

    const usuario = await User.findOne({
      _id: sessao.userId,
      ativo: true,
    })
      .select("_id nome email role")
      .lean();

    if (!usuario) {
      limparCookie(res);
      throw new SessionError();
    }

    res.cookie(
      "refreshToken",
      sessao.refreshToken,
      opcoesCookie(sessao.expiresAt)
    );

    return res.status(200).json({
      success: true,
      message: "Sessão renovada com sucesso.",
      data: {
        usuario: usuarioPublico(usuario),
        accessToken: sessao.accessToken,
        expiresAt: sessao.expiresAt,
      },
    });
  } catch (erro) {
    if (erro instanceof SessionError) {
      limparCookie(res);
    }

    return next(erro);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (
      typeof refreshToken === "string" &&
      refreshToken
    ) {
      await encerrarSessao({ refreshToken });
    }

    limparCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logout realizado com sucesso.",
    });
  } catch (erro) {
    return next(erro);
  }
}

async function me(req, res, next) {
  try {
    const usuario = await User.findOne({
      _id: req.auth.userId,
      ativo: true,
    })
      .select("_id nome email cpf telefone role")
      .lean();

    if (!usuario) {
      throw new SessionError();
    }

    return res.status(200).json({
      success: true,
      data: {
        usuario: {
          ...usuarioPublico(usuario),
          cpf: usuario.cpf,
          telefone: usuario.telefone,
        },
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarMeuPerfil(req, res, next) {
  try {
    const usuario = await atualizarDadosPessoais(
      req.auth.userId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Dados pessoais atualizados com sucesso.",
      data: {
        usuario,
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function enviarCodigoEmail(req, res, next) {
  try {
    const resultado = await solicitarCodigo(
      req.body?.email
    );

    return res.status(200).json({
      success: true,
      message: resultado.mensagem,
    });
  } catch (erro) {
    return next(erro);
  }
}

async function verificarEmail(req, res, next) {
  try {
    const resultado = await confirmarCodigo(
      req.body?.email,
      req.body?.codigo
    );

    return res.status(200).json({
      success: true,
      message: resultado.mensagem,
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  cadastro,
  login,
  refresh,
  logout,
  me,
  atualizarMeuPerfil,
  enviarCodigoEmail,
  verificarEmail,
};