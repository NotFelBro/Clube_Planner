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
const ORIGEM = process.env.FRONTEND_URL || "http://localhost:5173";
const ROTA_LOGIN = "/api/v1/auth/login";


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
    ...alteracoes,
  };
}

async function cadastrarPelaAPI(alteracoes = {}) {
  const dados = gerarDadosCadastro(alteracoes);

  const resposta = await request(app)
    .post(ROTA_CADASTRO)
    .set("Origin", ORIGEM)
    .send(dados);

  if (resposta.status === 201) {
    usuariosCriados.add(
      resposta.body.data.usuario.id
    );
  } else {
    const usuario = await User.findOne({
      email: dados.email.toLowerCase(),
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


async function confirmar(email, codigo) {
  return request(app).post("/api/v1/auth/verify-email").set("Origin", ORIGEM).send({ email, codigo });
}

describe("Cadastro e acesso por e-mail", () => {
  it("cadastra várias contas só com nome e e-mail e não armazena senha ou telefone", async () => {
    for (let i = 0; i < 2; i++) {
      const { dados, resposta } = await cadastrarUsuarioValido();
      expect(resposta.headers["set-cookie"]).toBeUndefined();
      expect(resposta.body.data.usuario.emailVerificado).toBe(false);
      const usuario = await User.collection.findOne({ email: dados.email });
      for (const campo of ["cpf", "telefone", "senhaHash"]) expect(usuario).not.toHaveProperty(campo);
      expect(emailService.enviarCodigoVerificacao).toHaveBeenCalledWith(dados.email, expect.stringMatching(/^\d{6}$/));
    }
  });

  it("valida nome, e-mail e duplicidade sem alterar a conta existente", async () => {
    expect((await cadastrarPelaAPI({ nome: "A" })).resposta.status).toBe(400);
    expect((await cadastrarPelaAPI({ email: "invalido" })).resposta.status).toBe(400);
    const { dados } = await cadastrarUsuarioValido();
    expect((await cadastrarPelaAPI({ email: dados.email.toUpperCase() })).resposta.status).toBe(409);
  });

  it("cria a sessão somente com um código válido e impede reutilização", async () => {
    const { dados } = await cadastrarUsuarioValido();
    const codigo = emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1];
    expect((await confirmar(dados.email, codigo === "000000" ? "111111" : "000000")).status).toBe(400);
    const acesso = await confirmar(dados.email, codigo);
    expect(acesso.status).toBe(200);
    expect(acesso.body.data.accessToken).toBeTruthy();
    expect(acesso.body.data.usuario.emailVerificado).toBe(true);
    expect(acesso.headers["set-cookie"][0]).toContain("HttpOnly");
    expect((await confirmar(dados.email, codigo)).status).toBe(400);
  });

  it("entra apenas com e-mail verificado, sem código e sem envio de e-mail", async () => {
    const { dados } = await cadastrarUsuarioValido();
    const login = () => request(app).post(ROTA_LOGIN).set("Origin", ORIGEM).send({ email: `  ${dados.email.toUpperCase()}  ` });
    const pendente = await login();
    expect(pendente.status).toBe(403);
    expect(pendente.headers["set-cookie"]).toBeUndefined();
    await confirmar(dados.email, emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1]);
    emailService.enviarCodigoVerificacao.mockClear();
    const acesso = await login();
    expect(acesso.status).toBe(200);
    expect(acesso.body.data.accessToken).toBeTruthy();
    expect(acesso.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(emailService.enviarCodigoVerificacao).not.toHaveBeenCalled();
    await User.updateOne({ email: dados.email }, { $set: { ativo: false } });
    expect((await login()).status).toBe(401);
  });

  it("não envia código nem cria conta ou sessão para e-mail inexistente", async () => {
    const email = `ausente-${randomUUID()}@example.com`;
    const resposta = await request(app).post(ROTA_LOGIN).set("Origin", ORIGEM).send({ email });
    expect(resposta.status).toBe(401);
    expect(emailService.enviarCodigoVerificacao).not.toHaveBeenCalled();
    expect(await User.exists({ email })).toBeNull();
    expect(resposta.headers["set-cookie"]).toBeUndefined();
    expect((await confirmar(email, "123456")).status).toBe(400);
  });

  it("rejeita login por CPF, requisição sem origem e código expirado", async () => {
    expect((await request(app).post(ROTA_LOGIN).set("Origin", ORIGEM).send({ email: "52998224725" })).status).toBe(400);
    expect((await request(app).post(ROTA_LOGIN).send({ email: "a@example.com" })).status).toBe(403);
    const { dados } = await cadastrarUsuarioValido();
    const codigo = emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1];
    await User.updateOne({ email: dados.email }, { $set: { "verificacaoEmail.expiraEm": new Date(0) } });
    expect((await confirmar(dados.email, codigo)).status).toBe(400);
  });

  it("limita tentativas de código e rejeita telefone na atualização do perfil", async () => {
    const { dados } = await cadastrarUsuarioValido();
    const codigo = emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1];
    const incorreto = codigo === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await confirmar(dados.email, incorreto)).status).toBe(400);
    expect((await confirmar(dados.email, codigo)).status).toBe(429);
    const outra = await cadastrarUsuarioValido();
    const acesso = await confirmar(outra.dados.email, emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1]);
    const atualizar = body => request(app).patch("/api/v1/auth/me").set("Origin", ORIGEM).set("Authorization", `Bearer ${acesso.body.data.accessToken}`).send(body);
    expect((await atualizar({ telefone: "11999999999" })).status).toBe(400);
    expect((await atualizar({ nome: "Novo nome" })).body.data.usuario.nome).toBe("Novo nome");
  });

  it("mantém o cadastro e permite reenviar quando o SMTP falha", async () => {
    emailService.enviarCodigoVerificacao.mockRejectedValueOnce(new Error("SMTP indisponível"));
    const { dados, resposta } = await cadastrarUsuarioValido();
    expect(resposta.body.data.codigoEnviado).toBe(false);
    expect((await request(app).post("/api/v1/auth/send-verification").set("Origin", ORIGEM).send({ email: dados.email })).status).toBe(200);
    const acesso = await confirmar(dados.email, emailService.enviarCodigoVerificacao.mock.calls.at(-1)[1]);
    expect(acesso.body.data.accessToken).toBeTruthy();
  });
});
