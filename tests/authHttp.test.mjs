import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";

import "dotenv/config";
import mongoose from "mongoose";
import request from "supertest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

import { gerarCpfTeste } from "./helpers/gerarCpfTeste.mjs";

const require = createRequire(import.meta.url);

const app = require("../src/app.js");
const User = require("../src/models/User.js");
const Session = require("../src/models/session.js");

const emailService = require(
  "../src/services/emailService.js"
);

const enviarEmailOriginal =
  emailService.enviarCodigoVerificacao;

const ROTA_CADASTRO = "/api/v1/auth/register";
const ROTA_LOGIN = "/api/v1/auth/login";

const SENHA_VALIDA = "SenhaSegura@2026!";

const usuariosCriados = new Set();

function obterUriDeTeste() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Os testes HTTP exigem NODE_ENV=test."
    );
  }

  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_TEST_URI não configurada."
    );
  }

  let url;

  try {
    url = new URL(uri);
  } catch {
    throw new Error(
      "MONGODB_TEST_URI possui formato inválido."
    );
  }

  const banco = decodeURIComponent(
    url.pathname.replace(/^\//, "")
  );

  const parametrosPermitidos = new Set([
    "replicaSet",
    "directConnection",
    "serverSelectionTimeoutMS",
  ]);

  const parametrosValidos = [
    ...url.searchParams.keys(),
  ].every((parametro) =>
    parametrosPermitidos.has(parametro)
  );

  if (
    url.protocol !== "mongodb:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "27017" ||
    banco !== "clube_planner_test" ||
    url.username ||
    url.password ||
    url.hash ||
    !parametrosValidos
  ) {
    throw new Error(
      "Destino MongoDB não autorizado para testes HTTP."
    );
  }

  return uri;
}

function gerarDadosCadastro(alteracoes = {}) {
  return {
    nome: "Cliente HTTP Teste",
    email: `http-${randomUUID()}@example.com`,
    cpf: gerarCpfTeste(),
    telefone: "11999999999",
    senha: SENHA_VALIDA,
    ...alteracoes,
  };
}

async function cadastrarPelaAPI(alteracoes = {}) {
  const dados = gerarDadosCadastro(alteracoes);

  const resposta = await request(app)
    .post(ROTA_CADASTRO)
    .send(dados);

  if (resposta.status === 201) {
    usuariosCriados.add(
      resposta.body.data.usuario.id
    );
  } else {
    const usuario = await User.findOne({
      email: dados.email.toLowerCase(),
      cpf: dados.cpf,
    }).select("_id");

    if (usuario) {
      usuariosCriados.add(
        String(usuario._id)
      );
    }
  }

  return {
    dados,
    resposta,
  };
}

async function cadastrarUsuarioValido() {
  const resultado = await cadastrarPelaAPI();

  expect(resultado.resposta.status).toBe(201);
  expect(resultado.resposta.body.success).toBe(true);

  return resultado;
}

// Exclusivo dos testes de autenticação:
// representa um usuário que já confirmou o e-mail.
async function cadastrarUsuarioVerificado() {
  const resultado = await cadastrarUsuarioValido();

  const atualizacao = await User.updateOne(
    {
      _id: resultado.resposta.body.data.usuario.id,
      email: resultado.dados.email,
      emailVerificado: false,
    },
    {
      $set: {
        emailVerificado: true,
        emailVerificadoEm: new Date(),
      },
    }
  );

  expect(atualizacao.matchedCount).toBe(1);
  expect(atualizacao.modifiedCount).toBe(1);

  return resultado;
}

beforeAll(async () => {
  const uri = obterUriDeTeste();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  if (
    mongoose.connection.name !==
    "clube_planner_test"
  ) {
    await mongoose.disconnect();

    throw new Error(
      "Conexão com banco de dados inesperado."
    );
  }

  await User.init();
  await Session.init();
}, 30000);

beforeEach(() => {
  emailService.enviarCodigoVerificacao = vi
    .fn()
    .mockResolvedValue(undefined);
});

afterEach(async () => {
  emailService.enviarCodigoVerificacao =
    enviarEmailOriginal;

  if (usuariosCriados.size === 0) {
    return;
  }

  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !==
      "clube_planner_test"
  ) {
    throw new Error(
      "Limpeza interrompida: conexão não autorizada."
    );
  }

  const ids = [...usuariosCriados].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  await Session.deleteMany({
    userId: {
      $in: ids,
    },
  });

  await User.deleteMany({
    _id: {
      $in: ids,
    },
  });

  usuariosCriados.clear();
});

afterAll(async () => {
  emailService.enviarCodigoVerificacao =
    enviarEmailOriginal;

  await mongoose.disconnect();
});

describe("RF-01 — Cadastro HTTP", () => {
  it("cadastra usuário válido com HTTP 201", async () => {
    const { dados, resposta } =
      await cadastrarUsuarioValido();

    expect(resposta.body.data.usuario).toMatchObject({
      nome: dados.nome,
      email: dados.email,
      role: "client",
    });

    expect(
      resposta.body.data.usuario.id
    ).toBeDefined();

    const usuario = await User.findOne({
      email: dados.email,
    }).select("+senhaHash");

    expect(usuario).not.toBeNull();

    expect(usuario.senhaHash).not.toBe(
      dados.senha
    );

    expect(usuario.emailVerificado).toBe(false);
    expect(usuario.emailVerificadoEm).toBeNull();

    expect(
      resposta.body.data.usuario
    ).not.toHaveProperty("senhaHash");

    expect(
      resposta.body.data.usuario
    ).not.toHaveProperty("cpf");
  });

  it("rejeita senha menor que 12 caracteres", async () => {
    const { dados, resposta } =
      await cadastrarPelaAPI({
        senha: "Curta@123",
      });

    expect(resposta.status).toBe(400);
    expect(resposta.body.success).toBe(false);

    expect(
      await User.exists({
        email: dados.email,
      })
    ).toBeNull();
  });

  it("rejeita e-mail inválido", async () => {
    const { resposta } =
      await cadastrarPelaAPI({
        email: "email-invalido",
      });

    expect(resposta.status).toBe(400);
    expect(resposta.body.success).toBe(false);
  });

  it("rejeita CPF matematicamente inválido", async () => {
    const { dados, resposta } =
      await cadastrarPelaAPI({
        cpf: "11111111111",
      });

    expect(resposta.status).toBe(400);
    expect(resposta.body.success).toBe(false);

    expect(
      await User.exists({
        email: dados.email,
      })
    ).toBeNull();
  });

  it("rejeita e-mail duplicado com HTTP 409", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const resposta = await request(app)
      .post(ROTA_CADASTRO)
      .send(
        gerarDadosCadastro({
          email: dados.email,
        })
      );

    expect(resposta.status).toBe(409);
    expect(resposta.body.success).toBe(false);

    expect(resposta.body.message).toBe(
      "E-mail ou CPF já cadastrado."
    );
  });

  it("rejeita CPF duplicado com HTTP 409", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const resposta = await request(app)
      .post(ROTA_CADASTRO)
      .send(
        gerarDadosCadastro({
          cpf: dados.cpf,
        })
      );

    expect(resposta.status).toBe(409);
    expect(resposta.body.success).toBe(false);

    expect(resposta.body.message).toBe(
      "E-mail ou CPF já cadastrado."
    );
  });

  it("não expõe dados sensíveis no cadastro", async () => {
    const { dados, resposta } =
      await cadastrarUsuarioValido();

    const conteudo = JSON.stringify(
      resposta.body
    );

    expect(conteudo).not.toContain(
      dados.senha
    );

    expect(conteudo).not.toContain(
      dados.cpf
    );

    expect(conteudo).not.toContain(
      "senhaHash"
    );
  });

  it("envia código automaticamente após cadastro válido", async () => {
    const { dados, resposta } =
      await cadastrarUsuarioValido();

    expect(resposta.body.data.codigoEnviado).toBe(true);

    expect(
      emailService.enviarCodigoVerificacao
    ).toHaveBeenCalledOnce();

    expect(
      emailService.enviarCodigoVerificacao
    ).toHaveBeenCalledWith(
      dados.email,
      expect.stringMatching(/^\d{6}$/)
    );

    const usuario = await User.findOne({
      email: dados.email,
    }).select(
      "+verificacaoEmail.codigoHash " +
      "+verificacaoEmail.expiraEm"
    );

    expect(usuario).not.toBeNull();
    expect(usuario.emailVerificado).toBe(false);

    expect(
      usuario.verificacaoEmail.codigoHash
    ).toBeTruthy();

    expect(
      usuario.verificacaoEmail.expiraEm
    ).toBeInstanceOf(Date);
  });

  it("mantém o cadastro quando o SMTP falha", async () => {
    emailService.enviarCodigoVerificacao = vi
      .fn()
      .mockRejectedValue(
        new Error("Falha SMTP simulada")
      );

    const { dados, resposta } =
      await cadastrarPelaAPI();

    expect(resposta.status).toBe(201);
    expect(resposta.body.success).toBe(true);

    expect(
      resposta.body.data.codigoEnviado
    ).toBe(false);

    expect(resposta.body.message).toContain(
      "não foi possível enviar o código"
    );

    const usuario = await User.findOne({
      email: dados.email,
    });

    expect(usuario).not.toBeNull();
    expect(usuario.emailVerificado).toBe(false);
  });

  it("não envia código quando o cadastro é inválido", async () => {
    const { resposta } =
      await cadastrarPelaAPI({
        senha: "curta",
      });

    expect(resposta.status).toBe(400);

    expect(
      emailService.enviarCodigoVerificacao
    ).not.toHaveBeenCalled();
  });
});

describe("RF-02 — Login HTTP", () => {
  it("autentica usuário por e-mail", async () => {
    const { dados } =
      await cadastrarUsuarioVerificado();

    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador: dados.email,
        senha: dados.senha,
      });

    expect(resposta.status).toBe(200);
    expect(resposta.body.success).toBe(true);

    expect(
      typeof resposta.body.data.accessToken
    ).toBe("string");

    expect(
      resposta.body.data.usuario.email
    ).toBe(dados.email);

    expect(
      resposta.body.data.expiresAt
    ).toBeDefined();
  });

  it("autentica usuário por CPF", async () => {
    const { dados } =
      await cadastrarUsuarioVerificado();

    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador: dados.cpf,
        senha: dados.senha,
      });

    expect(resposta.status).toBe(200);
    expect(resposta.body.success).toBe(true);

    expect(
      resposta.body.data.accessToken
    ).toBeTruthy();
  });

  it("rejeita senha incorreta com HTTP 401", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador: dados.email,
        senha: "SenhaIncorreta@2026!",
      });

    expect(resposta.status).toBe(401);
    expect(resposta.body.success).toBe(false);

    expect(resposta.body.message).toBe(
      "Credenciais inválidas."
    );
  });

  it("rejeita usuário inexistente com HTTP 401", async () => {
    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador:
          `inexistente-${randomUUID()}@example.com`,
        senha: SENHA_VALIDA,
      });

    expect(resposta.status).toBe(401);
    expect(resposta.body.success).toBe(false);

    expect(resposta.body.message).toBe(
      "Credenciais inválidas."
    );
  });

  it("configura o refresh token em cookie HTTP-only", async () => {
    const { dados } =
      await cadastrarUsuarioVerificado();

    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador: dados.email,
        senha: dados.senha,
      });

    expect(resposta.status).toBe(200);

    const cookies =
      resposta.headers["set-cookie"] || [];

    const refreshCookie = cookies.find(
      (cookie) =>
        cookie.startsWith("refreshToken=")
    );

    expect(refreshCookie).toBeDefined();

    expect(refreshCookie).toContain(
      "HttpOnly"
    );

    expect(refreshCookie).toContain(
      "SameSite=Lax"
    );

    expect(refreshCookie).toContain(
      "Path=/api/v1/auth"
    );

    expect(
      resposta.body.data
    ).not.toHaveProperty("refreshToken");

    expect(
      resposta.body.data.usuario
    ).not.toHaveProperty("senhaHash");
  });

  it("bloqueia login sem verificação de e-mail", async () => {
    const { dados, resposta: cadastro } =
      await cadastrarUsuarioValido();

    const resposta = await request(app)
      .post(ROTA_LOGIN)
      .send({
        identificador: dados.email,
        senha: dados.senha,
      });

    expect(resposta.status).toBe(403);
    expect(resposta.body.success).toBe(false);

    expect(resposta.body.message).toContain(
      "Confirme seu e-mail"
    );

    expect(
      resposta.body.data?.accessToken
    ).toBeUndefined();

    const quantidadeSessoes =
      await Session.countDocuments({
        userId: cadastro.body.data.usuario.id,
      });

    expect(quantidadeSessoes).toBe(0);
  });
});