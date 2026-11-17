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
  emailService.enviarLinkVerificacao;


const BASE = "/api/v1/auth";

const ORIGEM =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";


const usuariosCriados = new Set();

function obterUriDeTeste() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Os testes exigem NODE_ENV=test."
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
      "Destino MongoDB não autorizado."
    );
  }

  if (
    url.searchParams.get("replicaSet") !== "rs0"
  ) {
    throw new Error(
      "Replica set de testes inesperado."
    );
  }

  return uri;
}

function obterCookie(resposta) {
  const cookies =
    resposta.headers["set-cookie"] || [];

  const cookie = cookies.find((item) =>
    item.startsWith("refreshToken=")
  );

  if (!cookie) {
    throw new Error(
      "Cookie refreshToken não encontrado."
    );
  }

  return cookie.split(";")[0];
}

async function criarUsuario() {
  const dados = {
    nome: "Cliente Sessão Teste",
    senha: "senha-teste",
    aceitouPrivacidade: true,
    email:
      `session-${randomUUID()}@example.com`,
  };

  const resposta = await request(app)
    .post(`${BASE}/register`)
    .set("Origin", ORIGEM)
    .send(dados);

  if (resposta.status === 201) {
    usuariosCriados.add(
      resposta.body.data.usuario.id
    );
  } else {
    const usuario = await User.findOne({
      email: dados.email,
    }).select("_id");

    if (usuario) {
      usuariosCriados.add(
        String(usuario._id)
      );
    }
  }

  expect(resposta.status).toBe(201);

  // Simula uma confirmação de e-mail concluída,
  // exclusivamente no banco de testes.
  const atualizacao = await User.updateOne(
    {
      _id: resposta.body.data.usuario.id,
      email: dados.email,
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

  return dados;
}

async function fazerLogin(dados, userAgent = "") {
  const resposta = await request(app).post(`${BASE}/login`)
    .set("Origin", ORIGEM).set("User-Agent", userAgent).send({ email: dados.email, senha: dados.senha });
  expect(resposta.status).toBe(200);
  expect(resposta.body.data.accessToken).toBeTruthy();
  return resposta;
}

async function criarSessaoDeTeste() {
  const dados = await criarUsuario();

  const login = await fazerLogin(dados);

  return {
    dados,
    token: login.body.data.accessToken,
    cookie: obterCookie(login),
  };
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
  emailService.enviarLinkVerificacao =
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
      "Limpeza interrompida: banco não autorizado."
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
    enviarEmailOriginal;

  await mongoose.disconnect();
});

describe("Autenticação — Sessões HTTP", () => {
  it("salva endereços isolados por usuário", async () => {
    const { token } = await criarSessaoDeTeste();
    const outra = await criarSessaoDeTeste();
    const endereco = { pais: "Brasil", estado: "SP", cep: "01001000", cidade: "São Paulo", bairro: "Sé", logradouro: "Praça da Sé", numero: "10", complemento: "" };
    const criado = await request(app).post(`${BASE}/addresses`).set("Origin", ORIGEM).set("Authorization", `Bearer ${token}`).send(endereco);
    expect(criado.status).toBe(201);
    expect(criado.body.data.enderecos[0]).toMatchObject({ ...endereco, principal: true });
    expect((await request(app).get(`${BASE}/addresses`).set("Authorization", `Bearer ${token}`)).body.data.enderecos).toHaveLength(1);
    expect((await request(app).get(`${BASE}/addresses`).set("Authorization", `Bearer ${outra.token}`)).body.data.enderecos).toHaveLength(0);

  });

  it("rejeita endereços inválidos", async () => {
    const { token } = await criarSessaoDeTeste();
    const resposta = await request(app).post(`${BASE}/addresses`).set("Origin", ORIGEM).set("Authorization", `Bearer ${token}`).send({ pais: "Brasil", cep: "123" });
    expect(resposta.status).toBe(400);
    expect((await request(app).get(`${BASE}/cards`).set("Authorization", `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).post(`${BASE}/cards`).set("Origin", ORIGEM).set("Authorization", `Bearer ${token}`).send({})).status).toBe(404);
    expect((await request(app).get(`${BASE}/addresses`)).status).toBe(401);
  });

  it("mantém alteração direta de senha indisponível", async () => {
    const { token } = await criarSessaoDeTeste();
    for (const [method, path] of [["patch", "/password"]]) {
      const resposta = await request(app)[method](`${BASE}${path}`).set("Origin", ORIGEM).set("Authorization", `Bearer ${token}`).send({});
      expect(resposta.status).toBe(404);
    }
  });

  it("lista apenas sessões próprias, identifica aparelho e preserva identificação na renovação", async () => {
    const dados = await criarUsuario();
    await criarSessaoDeTeste();
    const login = await fazerLogin(dados, "Mozilla/5.0 (Linux; Android 13; SM-S901B) Mobile");
    const renovada = await request(app).post(`${BASE}/refresh`)
      .set("Origin", ORIGEM).set("Cookie", obterCookie(login));
    expect(renovada.status).toBe(200);
    const lista = await request(app).get(`${BASE}/sessions`)
      .set("Authorization", `Bearer ${renovada.body.data.accessToken}`);
    expect(lista.status).toBe(200);
    expect(lista.body.data.sessoes).toHaveLength(1);
    expect(lista.body.data.sessoes[0]).toMatchObject({ atual: true, dispositivo: { tipo: "mobile", nome: "Celular · Samsung" } });
    expect(lista.body.data.sessoes[0]).not.toHaveProperty("refreshTokenHash");
    expect(renovada.body.data.usuario.emailVerificado).toBe(true);
    const perfil = await request(app).get(`${BASE}/me`).set("Authorization", `Bearer ${renovada.body.data.accessToken}`);
    expect(perfil.body.data.usuario.emailVerificado).toBe(true);
  });

  it('emite refresh cookie Secure em produção e permite HTTP no desenvolvimento', async () => {
    const dados = await criarUsuario();
    const anterior = process.env.NODE_ENV;
    try {
      for (const ambiente of ['production', 'development']) {
        process.env.NODE_ENV = ambiente;
        const resposta = await fazerLogin(dados);
        expect(resposta.status).toBe(200);
        const cookie = resposta.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).toContain('Path=/api/v1/auth');
        expect(cookie.includes('; Secure')).toBe(ambiente === 'production');
      }
    } finally { process.env.NODE_ENV = anterior; }
  });

  it.each(["/refresh", "/refresh?restaurar=1"])("renova uma sessão válida em %s", async (rota) => {
    const { cookie } =
      await criarSessaoDeTeste();

    const resposta = await request(app)
      .post(`${BASE}${rota}`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(resposta.status).toBe(200);
    expect(resposta.body.success).toBe(true);

    expect(
      resposta.body.data.accessToken
    ).toBeTruthy();

    expect(
      resposta.body.data.usuario.id
    ).toBeTruthy();

    expect(
      resposta.body.data.usuario.role
    ).toBe("client");

    const novoCookie = obterCookie(resposta);

    expect(novoCookie).not.toBe(cookie);
  });

  it("rejeita refresh token já utilizado", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const primeira = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(primeira.status).toBe(200);

    const segunda = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(segunda.status).toBe(401);
    expect(segunda.body.success).toBe(false);
  });

  it("rejeita renovação sem cookie", async () => {
    const resposta = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM);

    expect(resposta.status).toBe(401);
  });

  it.each(["", "refreshToken=token-invalido"])(
    "restaura a navegação anônima com cookie ausente ou inválido (%s)",
    async (cookie) => {
      const requisicao = request(app)
        .post(`${BASE}/refresh?restaurar=1`)
        .set("Origin", ORIGEM);

      if (cookie) requisicao.set("Cookie", cookie);

      const resposta = await requisicao;

      expect(resposta.status).toBe(200);
      expect(resposta.body).toEqual({ success: true, data: { usuario: null } });
      expect(resposta.headers["cache-control"]).toBe("no-store");
      expect(obterCookie(resposta)).toBe("refreshToken=");
    }
  );

  it("rejeita refresh token inválido", async () => {
    const resposta = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM)
      .set(
        "Cookie",
        "refreshToken=token-invalido"
      );

    expect(resposta.status).toBe(401);
  });

  it("rejeita sessão expirada", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const valor = cookie.split("=")[1];

    const {
      calcularHashRefreshToken,
    } = require(
      "../src/services/authTokenService.js"
    );

    const hash =
      calcularHashRefreshToken(valor);

    await Session.updateOne(
      { refreshTokenHash: hash },
      {
        $set: {
          expiresAt: new Date(
            Date.now() - 1000
          ),
        },
      }
    );

    const resposta = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(resposta.status).toBe(401);
  });

  it("bloqueia origem não autorizada", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const resposta = await request(app)
      .post(`${BASE}/refresh`)
      .set(
        "Origin",
        "https://origem-nao-autorizada.example"
      )
      .set("Cookie", cookie);

    expect(resposta.status).toBe(403);
  });

  it("bloqueia renovação sem Origin", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const resposta = await request(app)
      .post(`${BASE}/refresh`)
      .set("Cookie", cookie);

    expect(resposta.status).toBe(403);
  });

  it("retorna o perfil autenticado", async () => {
    const { dados, token } =
      await criarSessaoDeTeste();

    const resposta = await request(app)
      .get(`${BASE}/me`)
      .set(
        "Authorization",
        `Bearer ${token}`
      );

    expect(resposta.status).toBe(200);

    expect(
      resposta.body.data.usuario
    ).toMatchObject({
      nome: dados.nome,
      email: dados.email,
      role: "client",
    });

    expect(
      resposta.body.data.usuario
    ).not.toHaveProperty("senhaHash");
  });

  it("rejeita perfil sem autenticação", async () => {
    const resposta = await request(app)
      .get(`${BASE}/me`);

    expect(resposta.status).toBe(401);
  });

  it("revoga a sessão no logout", async () => {
    const { cookie, token } =
      await criarSessaoDeTeste();

    const logout = await request(app)
      .post(`${BASE}/logout`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);

    const cookies =
      logout.headers["set-cookie"] || [];

    expect(
      cookies.some((item) =>
        item.startsWith("refreshToken=")
      )
    ).toBe(true);

    const perfil = await request(app)
      .get(`${BASE}/me`)
      .set(
        "Authorization",
        `Bearer ${token}`
      );

    expect(perfil.status).toBe(401);

    const renovacao = await request(app)
      .post(`${BASE}/refresh`)
      .set("Origin", ORIGEM)
      .set("Cookie", cookie);

    expect(renovacao.status).toBe(401);
  });

  it("bloqueia logout de origem externa", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const resposta = await request(app)
      .post(`${BASE}/logout`)
      .set(
        "Origin",
        "https://origem-externa.example"
      )
      .set("Cookie", cookie);

    expect(resposta.status).toBe(403);
  });

  it("não permite duas rotações simultâneas", async () => {
    const { cookie } =
      await criarSessaoDeTeste();

    const requisicoes = [
      request(app)
        .post(`${BASE}/refresh`)
        .set("Origin", ORIGEM)
        .set("Cookie", cookie),

      request(app)
        .post(`${BASE}/refresh`)
        .set("Origin", ORIGEM)
        .set("Cookie", cookie),
    ];

    const respostas =
      await Promise.all(requisicoes);

    const sucessos = respostas.filter(
      (resposta) => resposta.status === 200
    );

    const rejeicoes = respostas.filter(
      (resposta) => resposta.status === 401
    );

    expect(sucessos).toHaveLength(1);
    expect(rejeicoes).toHaveLength(1);
  });
});
it('limita o cadastro de endereços sem alterar os já salvos', async () => {
  const { dados, token } = await criarSessaoDeTeste();
  const endereco = { pais: 'Brasil', cep: '01001000', logradouro: 'Praça da Sé', numero: '10', bairro: 'Sé', cidade: 'São Paulo', estado: 'SP' };
  await User.updateOne({ email: dados.email }, { $set: { enderecos: Array.from({ length: 20 }, (_, i) => ({ ...endereco, principal: i === 0 })) } });
  const resposta = await request(app).post(`${BASE}/addresses`).set('Origin', ORIGEM).set('Authorization', `Bearer ${token}`).send(endereco);
  expect(resposta.status).toBe(409);
  expect((await User.findOne({ email: dados.email })).enderecos).toHaveLength(20);
});
