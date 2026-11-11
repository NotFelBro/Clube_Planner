
const User = require("../models/User");


class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

function validarTexto(valor, nome, minimo, maximo) {
  if (
    typeof valor !== "string" ||
    valor.trim().length < minimo ||
    valor.trim().length > maximo
  ) {
    throw new AuthError(`${nome} inválido.`);
  }

  return valor.trim();
}

function normalizarEmail(email) {
  const resultado = validarTexto(
    email,
    "E-mail",
    5,
    254
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resultado)) {
    throw new AuthError("E-mail inválido.");
  }

  return resultado;
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

function usuarioPerfil(usuario) {
  return {
    ...usuarioPublico(usuario),
    cpf: usuario.cpf,
  };
}

async function cadastrarUsuario(dados = {}) {
  const nome = validarTexto(
    dados.nome,
    "Nome",
    3,
    120
  );

  const email = normalizarEmail(dados.email);
  const existente = await User.exists({ email });
  if (existente) throw new AuthError("E-mail já cadastrado. Entre na sua conta ou solicite um código.", 409);

  let usuario;

  try {
    usuario = await User.create({
      nome,
      email,
      role: "client",
      ativo: true,
      emailVerificado: false,
      emailVerificadoEm: null,
    });
  } catch (erro) {
    if (erro.code === 11000) {
      throw new AuthError(
        "E-mail já cadastrado.",
        409
      );
    }

    if (erro.name === "ValidationError") {
      throw new AuthError(
        "Dados de cadastro inválidos."
      );
    }

    throw erro;
  }

  return usuarioPublico(usuario);
}

async function atualizarDadosPessoais(userId, dados) {
  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new AuthError(
      "Dados de atualização inválidos."
    );
  }

  const camposPermitidos = ["nome"];
  const camposRecebidos = Object.keys(dados);

  if (camposRecebidos.length === 0) {
    throw new AuthError(
      "Informe os dados que deseja atualizar."
    );
  }

  const camposInvalidos = camposRecebidos.filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (camposInvalidos.length > 0) {
    throw new AuthError(
      "Apenas o nome pode ser alterado por esta operação."
    );
  }

  const alteracoes = {};

  if (Object.hasOwn(dados, "nome")) {
    alteracoes.nome = validarTexto(
      dados.nome,
      "Nome",
      3,
      120
    );
  }

  let usuario;

  try {
    usuario = await User.findOneAndUpdate(
      {
        _id: userId,
        ativo: true,
      },
      {
        $set: alteracoes,
      },
      {
        new: true,
        runValidators: true,
      }
    );
  } catch (erro) {
    if (erro.name === "ValidationError") {
      throw new AuthError(
        "Dados de atualização inválidos."
      );
    }

    throw erro;
  }

  if (!usuario) {
    throw new AuthError(
      "Usuário não encontrado ou inativo.",
      401
    );
  }

  return usuarioPerfil(usuario);
}

module.exports = {
  AuthError,
  cadastrarUsuario,
  atualizarDadosPessoais,
};
