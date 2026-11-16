
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

const enviarOriginal =
  emailService.enviarLinkVerificacao;

const ROTA_CADASTRO =
  "/api/v1/auth/register";

const ROTA_LOGIN =
  "/api/v1/auth/login";

const ROTA_VERIFICACAO =
  "/api/v1/auth/verify-email";

const ROTA_REENVIO =
  "/api/v1/auth/send-verification";

const ORIGEM =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const usuariosCriados = new Set();

const segredoAnterior =
  process.env.EMAIL_CODE_SECRET;

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
      "MONGODB_TEST_URI inválida."
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
    senha: "senha-teste",
    aceitouPrivacidade: true,
    email: `http-${randomUUID()}@example.com`,
    ...alteracoes,
  };
}

function ultimoTokenEnviado() {
  const chamadas =
    emailService.enviarLinkVerificacao
      .mock.calls;

  const chamada = chamadas.at(-1);

  if (!chamada) {
    throw new Error(
      "Nenhum link de verificação foi enviado."
    );
  }

  const url = new URL(chamada[1]);

  const token = new URLSearchParams(
    url.hash.slice(1)
  ).get("token");

  if (!/^[a-f0-9]{64}$/i.test(token || "")) {
    throw new Error(
      "Token enviado possui formato inválido."
    );
  }

  return token;
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

  return { dados, resposta };
}

async function cadastrarUsuarioValido() {
  const resultado =
    await cadastrarPelaAPI();

  expect(
    resultado.resposta.status
  ).toBe(201);

  expect(
    resultado.resposta.body.success
  ).toBe(true);

  return resultado;
}

function confirmar(token) {
  return request(app)
    .post(ROTA_VERIFICACAO)
    .set("Origin", ORIGEM)
    .send({ token });
}

function entrar(email, senha = "senha-teste") {
  return request(app)
    .post(ROTA_LOGIN)
    .set("Origin", ORIGEM)
    .send({ email, senha });
}

beforeAll(async () => {
  const uri = obterUriDeTeste();

  process.env.EMAIL_CODE_SECRET =
    "a".repeat(64);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  if (
    mongoose.connection.name !==
    "clube_planner_test"
  ) {
    await mongoose.disconnect();

    throw new Error(
      "Conexão com banco inesperado."
    );
  }

  await User.init();
  await Session.init();
}, 30000);

beforeEach(() => {
  emailService.enviarLinkVerificacao = vi
    .fn()
    .mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  emailService.enviarLinkVerificacao =
    enviarOriginal;

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
    userId: { $in: ids },
  });

  await User.deleteMany({
    _id: { $in: ids },
  });

  usuariosCriados.clear();
});

afterAll(async () => {
  emailService.enviarLinkVerificacao =
    enviarOriginal;

  if (segredoAnterior === undefined) {
    delete process.env.EMAIL_CODE_SECRET;
  } else {
    process.env.EMAIL_CODE_SECRET =
      segredoAnterior;
  }

  await mongoose.disconnect();
});

describe("Cadastro e acesso por link", () => {
  it("cadastra com senha protegida e sem telefone", async () => {
    for (let i = 0; i < 2; i++) {
      const { dados, resposta } =
        await cadastrarUsuarioValido();

      expect(
        resposta.headers["set-cookie"]
      ).toBeUndefined();

      expect(
        resposta.body.data.usuario
          .emailVerificado
      ).toBe(false);

      expect(
        resposta.body.data.linkEnviado
      ).toBe(true);

      const usuario =
        await User.collection.findOne({
          email: dados.email,
        });

      for (const campo of [
        "cpf",
        "telefone",
      ]) {
        expect(usuario).not.toHaveProperty(
          campo
        );
      }

      expect(usuario.senhaHash).toMatch(/^scrypt\$/);
      expect(usuario.senhaHash).not.toBe(dados.senha);
      expect(usuario.privacidadeAceitaEm).toBeInstanceOf(Date);
      expect(resposta.body.data.usuario).not.toHaveProperty("senhaHash");

      expect(
        emailService.enviarLinkVerificacao
      ).toHaveBeenCalledWith(
        dados.email,
        expect.stringContaining(
          "/confirmar-email#token="
        )
      );
    }
  });

  it("valida nome, e-mail e duplicidade", async () => {
    expect(
      (
        await cadastrarPelaAPI({
          nome: "A",
        })
      ).resposta.status
    ).toBe(400);

    expect(
      (
        await cadastrarPelaAPI({
          email: "invalido",
        })
      ).resposta.status
    ).toBe(400);

    const { dados } =
      await cadastrarUsuarioValido();

    expect(
      (
        await cadastrarPelaAPI({
          email: dados.email.toUpperCase(),
        })
      ).resposta.status
    ).toBe(409);
  });

  it("confirma token e cria sessão", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const token = ultimoTokenEnviado();

    const invalido =
      await confirmar("0".repeat(64));

    expect(invalido.status).toBe(400);

    const acesso = await confirmar(token);

    expect(acesso.status).toBe(200);

    expect(
      acesso.body.data.accessToken
    ).toBeTruthy();

    expect(
      acesso.body.data.usuario.emailVerificado
    ).toBe(true);

    expect(
      acesso.headers["set-cookie"][0]
    ).toContain("HttpOnly");

    const usuario = await User.findOne({
      email: dados.email,
    });

    expect(
      usuario.emailVerificado
    ).toBe(true);

    expect(
      usuario.emailVerificadoEm
    ).toBeInstanceOf(Date);

    expect(
      await confirmar(token)
    ).toHaveProperty("status", 400);
  });

  it("mantém login somente para conta verificada", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const loginPendente =
      await entrar(dados.email);

    expect(loginPendente.status).toBe(403);

    expect(
      loginPendente.headers["set-cookie"]
    ).toBeUndefined();

    const token = ultimoTokenEnviado();

    expect(
      (await confirmar(token)).status
    ).toBe(200);

    emailService.enviarLinkVerificacao
      .mockClear();

    const acesso = await entrar(
      `  ${dados.email.toUpperCase()}  `
    );

    expect(acesso.status).toBe(200);

    expect(
      acesso.body.data.accessToken
    ).toBeTruthy();

    expect(
      acesso.headers["set-cookie"][0]
    ).toContain("HttpOnly");

    expect(
      emailService.enviarLinkVerificacao
    ).not.toHaveBeenCalled();

    await User.updateOne(
      { email: dados.email },
      { $set: { ativo: false } }
    );

    expect(
      (await entrar(dados.email)).status
    ).toBe(401);
  });

  it("rejeita login de conta inexistente", async () => {
    const email =
      `ausente-${randomUUID()}@example.com`;

    const resposta = await entrar(email);

    expect(resposta.status).toBe(401);

    expect(
      emailService.enviarLinkVerificacao
    ).not.toHaveBeenCalled();

    expect(
      await User.exists({ email })
    ).toBeNull();

    expect(
      resposta.headers["set-cookie"]
    ).toBeUndefined();

    expect(
      (await confirmar("a".repeat(64))).status
    ).toBe(400);
  });

  it("rejeita CPF, origem ausente e token expirado", async () => {
    const loginCpf = await entrar(
      "52998224725"
    );

    expect(loginCpf.status).toBe(400);

    const semOrigem = await request(app)
      .post(ROTA_LOGIN)
      .send({
        email: "a@example.com",
      });

    expect(semOrigem.status).toBe(403);

    const { dados } =
      await cadastrarUsuarioValido();

    const token = ultimoTokenEnviado();

    await User.updateOne(
      { email: dados.email },
      {
        $set: {
          "verificacaoEmail.expiraEm":
            new Date(0),
        },
      }
    );

    expect(
      (await confirmar(token)).status
    ).toBe(400);
  });

  it("rejeita token inválido e alteração de telefone", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    expect(
      (await confirmar("123456")).status
    ).toBe(400);

    expect(
      (await confirmar("f".repeat(64))).status
    ).toBe(400);

    const token = ultimoTokenEnviado();

    const acesso = await confirmar(token);

    expect(acesso.status).toBe(200);

    const atualizar = (body) =>
      request(app)
        .patch("/api/v1/auth/me")
        .set("Origin", ORIGEM)
        .set(
          "Authorization",
          `Bearer ${acesso.body.data.accessToken}`
        )
        .send(body);

    expect(
      (
        await atualizar({
          telefone: "11999999999",
        })
      ).status
    ).toBe(400);

    const perfil = await atualizar({
      nome: "Novo nome",
    });

    expect(perfil.status).toBe(200);

    expect(
      perfil.body.data.usuario.nome
    ).toBe("Novo nome");

    const usuario = await User.findOne({
      email: dados.email,
    });

    expect(usuario.nome).toBe(
      "Novo nome"
    );
  });

  it("mantém cadastro se SMTP falhar e permite reenviar", async () => {
    emailService.enviarLinkVerificacao
      .mockRejectedValueOnce(
        new Error("SMTP indisponível")
      );

    const erroConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const { dados, resposta } =
        await cadastrarUsuarioValido();

      expect(
        resposta.body.data.linkEnviado
      ).toBe(false);

      const usuario = await User.findOne({
        email: dados.email,
      });

      expect(usuario).not.toBeNull();

      expect(
        usuario.emailVerificado
      ).toBe(false);

      const reenvio = await request(app)
        .post(ROTA_REENVIO)
        .set("Origin", ORIGEM)
        .send({ email: dados.email });

      expect(reenvio.status).toBe(200);

      const token = ultimoTokenEnviado();

      const acesso = await confirmar(token);

      expect(acesso.status).toBe(200);

      expect(
        acesso.body.data.accessToken
      ).toBeTruthy();
    } finally {
      erroConsole.mockRestore();
    }
  });

  it("bloqueia verificação sem Origin", async () => {
    const { dados } =
      await cadastrarUsuarioValido();

    const token = ultimoTokenEnviado();

    const resposta = await request(app)
      .post(ROTA_VERIFICACAO)
      .send({ token });

    expect(resposta.status).toBe(403);

    const usuario = await User.findOne({
      email: dados.email,
    });

    expect(
      usuario.emailVerificado
    ).toBe(false);
  });

  it("não envia link para conta inexistente", async () => {
    const email =
      `nao-existe-${randomUUID()}@example.com`;

    const resposta = await request(app)
      .post(ROTA_REENVIO)
      .set("Origin", ORIGEM)
      .send({ email });

    expect(resposta.status).toBe(200);

    expect(
      emailService.enviarLinkVerificacao
    ).not.toHaveBeenCalled();

    expect(
      await User.exists({ email })
    ).toBeNull();
  });
});

describe('Senha e aceite obrigatório', () => {
  it('recusa cadastro sem senha ou sem aceite explícito', async () => {
    for (const dados of [{ senha: undefined }, { senha: '' }, { aceitouPrivacidade: false }, { aceitouPrivacidade: 'true' }]) {
      const resultado = await cadastrarPelaAPI(dados);
      expect(resultado.resposta.status).toBe(400);
      expect(await User.exists({ email: resultado.dados.email })).toBeNull();
    }
  });
  it('recusa senha ausente, errada ou truncada, e aceita senha longa sem composição obrigatória', async () => {
    const senha = 'á'.repeat(500) + '📝';
    const { dados } = await cadastrarPelaAPI({ senha });
    await confirmar(ultimoTokenEnviado());
    expect((await entrar(dados.email, '')).status).toBe(400);
    expect((await entrar(dados.email, senha.slice(0, 72))).status).toBe(401);
    const acesso = await entrar(dados.email, senha);
    expect(acesso.status).toBe(200);
    expect(acesso.body.data.usuario).not.toHaveProperty('senhaHash');
    expect(acesso.body.data.usuario).not.toHaveProperty('recuperacaoSenha');
  });
  it('conta antiga sem senha usa recuperação por e-mail, com token de uso único e revogação das sessões', async () => {
    const { dados } = await cadastrarUsuarioValido();
    await confirmar(ultimoTokenEnviado());
    await User.updateOne({ email: dados.email }, { $unset: { senhaHash: '' } });
    expect((await entrar(dados.email)).status).toBe(401);
    const envio = vi.spyOn(emailService, 'enviarLinkSenha').mockResolvedValue(undefined);
    const solicitar = email => request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGEM).send({ email });
    const resposta = await solicitar(dados.email);
    expect(resposta.status).toBe(200);
    const desconhecido = await solicitar(`ausente-${randomUUID()}@example.com`);
    expect(desconhecido.body).toEqual(resposta.body);
    expect(envio).toHaveBeenCalledTimes(1);
    const token = new URLSearchParams(new URL(envio.mock.calls[0][1]).hash.slice(1)).get('token');
    const salvo = await User.findOne({ email: dados.email }).select('+recuperacaoSenha.tokenHash');
    expect(salvo.recuperacaoSenha.tokenHash).not.toBe(token);
    const reset = body => request(app).post('/api/v1/auth/reset-password').set('Origin', ORIGEM).send(body);
    expect((await reset({ token, senha: 'nova' })).status).toBe(400);
    expect((await reset({ token, senha: 'nova', aceitouPrivacidade: true })).status).toBe(200);
    expect((await reset({ token, senha: 'outra', aceitouPrivacidade: true })).status).toBe(400);
    expect((await entrar(dados.email, 'nova')).status).toBe(200);
    expect((await entrar(dados.email, 'senha-teste')).status).toBe(401);
    const usuario = await User.findOne({ email: dados.email });
    expect(await Session.countDocuments({ userId: usuario._id, revokedAt: null })).toBe(1);
  });
  it('não aceita link expirado e não envia recuperação para conta não verificada', async () => {
    const { dados } = await cadastrarUsuarioValido();
    const envio = vi.spyOn(emailService, 'enviarLinkSenha').mockResolvedValue(undefined);
    const solicitar = () => request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGEM).send({ email: dados.email });
    await solicitar(); expect(envio).not.toHaveBeenCalled();
    await confirmar(ultimoTokenEnviado());
    await solicitar();
    const token = new URLSearchParams(new URL(envio.mock.calls[0][1]).hash.slice(1)).get('token');
    await User.updateOne({ email: dados.email }, { $set: { 'recuperacaoSenha.expiraEm': new Date(0) } });
    const resposta = await request(app).post('/api/v1/auth/reset-password').set('Origin', ORIGEM).send({ token, senha: 'nova', aceitouPrivacidade: true });
    expect(resposta.status).toBe(400);
    expect((await entrar(dados.email)).status).toBe(200);
  });
});

describe('Um e-mail por solicitação elegível', () => {
  it('não duplica a verificação em solicitações simultâneas e só reenvia por novo pedido', async () => {
    const { dados } = await cadastrarUsuarioValido();
    expect(emailService.enviarLinkVerificacao).toHaveBeenCalledTimes(1);
    const solicitar = () => request(app).post(ROTA_REENVIO).set('Origin', ORIGEM).send({ email: dados.email });
    await Promise.all(Array.from({ length: 5 }, solicitar));
    expect(emailService.enviarLinkVerificacao).toHaveBeenCalledTimes(1);
    await User.updateOne({ email: dados.email }, { $set: { 'verificacaoEmail.ultimoEnvioEm': new Date(Date.now() - 61000) } });
    await Promise.all(Array.from({ length: 5 }, solicitar));
    expect(emailService.enviarLinkVerificacao).toHaveBeenCalledTimes(2);
  });
  it('não duplica redefinição e exige nova solicitação depois do intervalo', async () => {
    const { dados } = await cadastrarUsuarioValido();
    await confirmar(ultimoTokenEnviado());
    const enviar = vi.spyOn(emailService, 'enviarLinkSenha').mockResolvedValue(undefined);
    const solicitar = () => request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGEM).send({ email: dados.email });
    await Promise.all(Array.from({ length: 5 }, solicitar));
    expect(enviar).toHaveBeenCalledTimes(1);
    await solicitar();
    expect(enviar).toHaveBeenCalledTimes(1);
    await User.updateOne({ email: dados.email }, { $set: { 'recuperacaoSenha.ultimoEnvioEm': new Date(Date.now() - 61000) } });
    await Promise.all(Array.from({ length: 5 }, solicitar));
    expect(enviar).toHaveBeenCalledTimes(2);
  });
});

describe('Proteções da conta', () => {
  it('garante unicidade de e-mail mesmo em dois cadastros simultâneos', async () => {
    const dados = gerarDadosCadastro();
    const registrar = () => request(app).post(ROTA_CADASTRO).set('Origin', ORIGEM).send(dados);
    const respostas = await Promise.all([registrar(), registrar()]);
    const usuario = await User.findOne({ email: dados.email });
    if (usuario) usuariosCriados.add(String(usuario._id));
    expect(respostas.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments({ email: dados.email })).toBe(1);
  });
});

it('bloqueia sessão com credencial antiga mesmo se criada depois da redefinição', async () => {
  const { dados } = await cadastrarUsuarioValido();
  await confirmar(ultimoTokenEnviado());
  const usuario = await User.findOne({ email: dados.email });
  // Simula uma transação de login que leu a senha antiga antes da troca.
  await User.updateOne({ _id: usuario._id }, { $inc: { credencialVersao: 1 } });
  const sessao = await Session.create({ userId: usuario._id, familyId: new mongoose.Types.ObjectId(), refreshTokenHash: 'race-' + randomUUID(), expiresAt: new Date(Date.now() + 3600000), credencialVersao: 0 });
  const { emitirAccessToken } = require('../src/services/authTokenService');
  const token = emitirAccessToken({ userId: usuario._id, sessionId: sessao._id });
  const resposta = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
  expect(resposta.status).toBe(401);
});
