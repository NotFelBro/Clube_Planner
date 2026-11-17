
const {
  cadastrarUsuario,
  atualizarDadosPessoais,
  usuarioPerfil,
  AuthError,
} = require("../services/authService");

const {
  criarSessao,
  renovarSessao,
  encerrarSessao,
  SessionError,
} = require("../services/sessionService");

const {
  solicitarLink,
  confirmarLink,
} = require("../services/emailVerificationService");

const User = require("../models/User");
const { validarSenha, verificarSenha } = require("../services/passwordService");

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
    emailVerificadoEm:
      usuario.emailVerificadoEm ?? null,
  };
}

async function cadastro(req, res, next) {
  try {
    const usuario = await cadastrarUsuario(req.body);
    let linkEnviado = false;

    try {
      await solicitarLink(usuario.email);
      linkEnviado = true;
    } catch (erro) {
      if (erro.statusCode !== 503) {
        return next(erro);
      }

      console.error(
        "Falha no envio após cadastro:",
        erro.message
      );
    }

    return res.status(201).json({
      success: true,
      message: linkEnviado
        ? "Cadastro realizado. Verifique o link enviado para seu e-mail."
        : "Cadastro realizado, mas o link não pôde ser enviado. Solicite um novo envio.",
      data: {
        usuario,
        linkEnviado,
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function login(req, res, next) {
  try {
    const email = req.body?.email;
    const senha = validarSenha(req.body?.senha);

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      throw new AuthError("E-mail inválido.");
    }

    const usuario = await User.findOne({
      email: email.trim().toLowerCase(),
      ativo: true,
    })
      .select(
        "_id nome email role emailVerificado emailVerificadoEm credencialVersao +senhaHash"
      )
      .lean();

    const senhaCorreta = await verificarSenha(senha, usuario?.senhaHash);
    if (!usuario || !senhaCorreta) {
      throw new AuthError("E-mail ou senha incorretos. Se ainda não tem senha, use a opção de definir ou recuperar senha.", 401);
    }

    if (usuario.emailVerificado !== true) {
      throw new AuthError(
        "Confirme seu e-mail no cadastro antes de entrar.",
        403
      );
    }

    const sessao = await criarSessao({
      userId: String(usuario._id),
      credencialVersao: usuario.credencialVersao ?? 0,
      userAgent: req.get("user-agent"),
    });

    res.cookie(
      "refreshToken",
      sessao.refreshToken,
      opcoesCookie(sessao.expiresAt)
    );

    return res.status(200).json({
      success: true,
      data: {
        usuario: usuarioPublico(usuario),
        accessToken: sessao.accessToken,
        expiresAt: sessao.expiresAt,
      },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function refresh(req, res, next) {
  res.set("Cache-Control", "no-store");

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
      .select(
        "_id nome email role emailVerificado emailVerificadoEm"
      )
      .lean();

    if (!usuario) {
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

      if (req.query.restaurar === "1") {
        return res.status(200).json({
          success: true,
          data: { usuario: null },
        });
      }
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
      .select(
        "_id nome email cpf role emailVerificado emailVerificadoEm +alteracaoEmail.novoEmail +alteracaoEmail.expiraEm"
      )
      .lean();

    if (!usuario) {
      throw new SessionError();
    }

    return res.status(200).json({
      success: true,
      data: {
        usuario: usuarioPerfil(usuario),
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
      message:
        "Dados pessoais atualizados com sucesso.",
      data: { usuario },
    });
  } catch (erro) {
    return next(erro);
  }
}

async function enviarLinkEmail(req, res, next) {
  try {
    const resultado = await solicitarLink(
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
    const usuario = await confirmarLink(
      req.body?.token
    );

    // O token já foi consumido e a conta foi
    // confirmada. Agora criamos a sessão.
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
        message: "E-mail confirmado com sucesso.",
        data: {
          usuario: usuarioPublico(usuario),
          accessToken: sessao.accessToken,
          expiresAt: sessao.expiresAt,
        },
      });
    } catch (erroSessao) {
      console.error(
        "E-mail confirmado, mas falhou a criação da sessão:",
        erroSessao.code || erroSessao.message
      );

      return res.status(200).json({
        success: true,
        message:
          "E-mail confirmado com sucesso. Entre na sua conta para continuar.",
        data: {
          sessaoCriada: false,
        },
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
  enviarLinkEmail,
  verificarEmail,
};
