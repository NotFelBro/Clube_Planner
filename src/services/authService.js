
const User = require("../models/User");
const { gerarHashSenha, validarSenha } = require("./passwordService");


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
    emailPendente: usuario.alteracaoEmail?.expiraEm > new Date() ? usuario.alteracaoEmail.novoEmail : null,
    emailPendenteExpiraEm: usuario.alteracaoEmail?.expiraEm > new Date() ? usuario.alteracaoEmail.expiraEm : null,
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
  validarSenha(dados.senha);
  if (dados.aceitouPrivacidade !== true) throw new AuthError("Aceite os termos de privacidade para criar sua conta.");
  const existente = await User.exists({ email, ativo: true });
  if (existente) throw new AuthError("E-mail já cadastrado. Entre na sua conta ou solicite um código.", 409);

  let usuario;

  try {
    usuario = await User.create({
      nome,
      email,
      senhaHash: await gerarHashSenha(dados.senha),
      privacidadeAceitaEm: new Date(),
      privacidadeVersao: "2026-11-13",
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

  const camposPermitidos = ["nome", "cpf"];
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
      "Apenas nome e CPF podem ser alterados diretamente. O e-mail exige confirmação separada."
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

  const remover = {};
  if (Object.hasOwn(dados, 'cpf')) {
    if (typeof dados.cpf !== 'string' || dados.cpf.length > 32 || !/^[\d.\-\s]*$/.test(dados.cpf)) throw new AuthError('CPF inválido.');
    const cpf = dados.cpf.replace(/\D/g, '');
    if (!cpf) remover.cpf = '';
    else { if (!User.validarCPF(cpf)) throw new AuthError('CPF inválido.'); alteracoes.cpf = cpf; }
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
        ...(Object.keys(remover).length ? { $unset: remover } : {}),
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("+alteracaoEmail.novoEmail +alteracaoEmail.expiraEm");
  } catch (erro) {
    if (erro.code === 11000) throw new AuthError("CPF já cadastrado em outra conta ativa.", 409);
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
  normalizarEmail,
  usuarioPerfil,
};
