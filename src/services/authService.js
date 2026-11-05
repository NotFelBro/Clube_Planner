
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { criarSessao } = require("./sessionService");

const CUSTO_BCRYPT = 12;

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

function normalizarCPF(cpf) {
  if (typeof cpf !== "string") {
    throw new AuthError("CPF inválido.");
  }

  const resultado = cpf.replace(/\D/g, "");

  if (!/^\d{11}$/.test(resultado)) {
    throw new AuthError("CPF inválido.");
  }

  return resultado;
}

function validarSenha(senha) {
  if (
    typeof senha !== "string" ||
    senha.length < 12 ||
    Buffer.byteLength(senha, "utf8") > 72
  ) {
    throw new AuthError(
      "A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes."
    );
  }

  return senha;
}

function usuarioPublico(usuario) {
  return {
    id: String(usuario._id),
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
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
  const cpf = normalizarCPF(dados.cpf);

  const telefone = validarTexto(
    dados.telefone,
    "Telefone",
    8,
    20
  );

  const senha = validarSenha(dados.senha);

  const existente = await User.exists({
    $or: [{ email }, { cpf }],
  });

  if (existente) {
    throw new AuthError(
      "E-mail ou CPF já cadastrado.",
      409
    );
  }

  const senhaHash = await bcrypt.hash(
    senha,
    CUSTO_BCRYPT
  );

  let usuario;

  try {
    usuario = await User.create({
      nome,
      email,
      cpf,
      telefone,
      senhaHash,
      role: "client",
      ativo: true,
    });
  } catch (erro) {
    if (erro.code === 11000) {
      throw new AuthError(
        "E-mail ou CPF já cadastrado.",
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

async function autenticarUsuario(dados = {}) {
  const identificador = dados.identificador;

  if (
    typeof identificador !== "string" ||
    !identificador.trim() ||
    typeof dados.senha !== "string"
  ) {
    throw new AuthError(
      "Credenciais inválidas.",
      401
    );
  }

  const valor = identificador.trim();
  const filtro = valor.includes("@")
    ? { email: valor.toLowerCase() }
    : { cpf: valor.replace(/\D/g, "") };

  const usuario = await User.findOne({
    ...filtro,
    ativo: true,
  }).select("+senhaHash");

  if (
    !usuario ||
    typeof usuario.senhaHash !== "string"
  ) {
    throw new AuthError(
      "Credenciais inválidas.",
      401
    );
  }

  const senhaCorreta = await bcrypt.compare(
    dados.senha,
    usuario.senhaHash
  );

  if (!senhaCorreta) {
    throw new AuthError(
      "Credenciais inválidas.",
      401
    );
  }

  const sessao = await criarSessao({
    userId: usuario._id,
  });

  return {
    usuario: usuarioPublico(usuario),
    sessao,
  };
}

module.exports = {
  AuthError,
  cadastrarUsuario,
  autenticarUsuario,
};
