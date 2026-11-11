
const {
  cadastrarUsuario,
  atualizarDadosPessoais,
  AuthError,
} = require("../services/authService");

const {
  criarSessao,
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
    emailVerificado: usuario.emailVerificado === true,
    emailVerificadoEm: usuario.emailVerificadoEm ?? null,
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
    const email = req.body?.email;
    if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AuthError("E-mail inválido.");
    }
    const usuario = await User.findOne({ email: email.trim().toLowerCase(), ativo: true })
      .select("_id nome email role emailVerificado emailVerificadoEm").lean();
    if (!usuario) throw new AuthError("E-mail não cadastrado ou conta inativa.", 401);
    if (usuario.emailVerificado !== true) throw new AuthError("Confirme seu e-mail no cadastro antes de entrar.", 403);
    const sessao = await criarSessao({ userId: String(usuario._id), userAgent: req.get("user-agent") });
    res.cookie("refreshToken", sessao.refreshToken, opcoesCookie(sessao.expiresAt));
    return res.status(200).json({
      success: true,
      data: { usuario: usuarioPublico(usuario), accessToken: sessao.accessToken, expiresAt: sessao.expiresAt },
    });
  } catch (erro) { return next(erro); }
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
      .select("_id nome email role emailVerificado emailVerificadoEm")
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
      .select("_id nome email cpf role emailVerificado emailVerificadoEm")
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

    // O código já foi validado e consumido.
    // Somente após essa confirmação criamos a sessão.
    const emailNormalizado =
      req.body.email.trim().toLowerCase();

    const usuario = await User.findOne({
      email: emailNormalizado,
      ativo: true,
      emailVerificado: true,
    })
      .select("_id nome email role emailVerificado emailVerificadoEm")
      .lean();

    if (!usuario) {
      return res.status(200).json({
        success: true,
        message:
          "E-mail confirmado com sucesso. Entre na sua conta para continuar.",
      });
    }

    try {
      const sessao = await criarSessao({
        userId: String(usuario._id),
        userAgent: req.get("user-agent"),
      });

      res.cookie(
        "refreshToken",
        sessao.refreshToken,
        opcoesCookie(sessao.expiresAt)
      );

      return res.status(200).json({
        success: true,
        message: resultado.mensagem,
        data: {
          usuario: usuarioPublico(usuario),
          accessToken: sessao.accessToken,
          expiresAt: sessao.expiresAt,
        },
      });
    } catch (erroSessao) {
      // O e-mail permanece confirmado.
      // Em caso de falha na sessão, o login
      // por código continua disponível.
      console.error(
        "E-mail confirmado, mas falhou a criação da sessão:",
        erroSessao.code || erroSessao.message
      );

      return res.status(200).json({
        success: true,
        message:
          "E-mail confirmado com sucesso. Entre na sua conta para continuar.",
      });
    }
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
