
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";

import "dotenv/config";
import mongoose from "mongoose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const User = require("../src/models/User.js");

function criarDados(alteracoes = {}) {
  return {
    nome: "Cliente Teste",
    email: "cliente@example.com",
    cpf: "52998224725",
    telefone: "11999999999",
    senhaHash: "hash-ficticio-para-teste",
    ...alteracoes,
  };
}

describe("DM-USER-01 — Modelo User", () => {
  it("aceita um CPF válido", async () => {
    const usuario = new User(criarDados());

    await expect(usuario.validate()).resolves.toBeUndefined();
  });

  it("rejeita um CPF inválido", async () => {
    const usuario = new User(
      criarDados({ cpf: "11111111111" })
    );

    await expect(usuario.validate()).rejects.toThrow(
      "CPF inválido"
    );
  });

  it("normaliza o CPF removendo a pontuação", () => {
    const usuario = new User(
      criarDados({ cpf: "529.982.247-25" })
    );

    expect(usuario.cpf).toBe("52998224725");
  });

  it("normaliza o e-mail para letras minúsculas", () => {
    const usuario = new User(
      criarDados({ email: "  CLIENTE@EXAMPLE.COM  " })
    );

    expect(usuario.email).toBe("cliente@example.com");
  });

  it("declara índice único global para CPF", () => {
    const indice = User.schema.indexes().find(
      ([campos]) => campos.cpf === 1
    );

    expect(indice).toBeDefined();
    expect(indice[1].unique).toBe(true);
    expect(indice[1].partialFilterExpression).toBeUndefined();
  });

  it("declara índice único global para e-mail", () => {
    const indice = User.schema.indexes().find(
      ([campos]) => campos.email === 1
    );

    expect(indice).toBeDefined();
    expect(indice[1].unique).toBe(true);
    expect(indice[1].partialFilterExpression).toBeUndefined();
  });
});


describe("DM-USER-01 — Unicidade no MongoDB", () => {
  let conexao;
  let UsuarioTeste;
  const idsCriados = [];

  const criarUsuario = async (alteracoes = {}) => {
    const usuario = await UsuarioTeste.create(
      criarDados({
        email: `teste-${new mongoose.Types.ObjectId()}@example.com`,
        cpf: "52998224725",
        ...alteracoes,
      })
    );

    idsCriados.push(usuario._id);
    return usuario;
  };

  beforeAll(async () => {
    const uri = process.env.MONGODB_TEST_URI;

    if (!uri) {
      throw new Error("MONGODB_TEST_URI não configurada.");
    }

    const url = new URL(uri);

    if (
      url.protocol !== "mongodb:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "27017" ||
      url.pathname !== "/clube_planner_test"
    ) {
      throw new Error("Destino MongoDB não autorizado.");
    }

    conexao = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
    });

    await conexao.asPromise();

    if (conexao.name !== "clube_planner_test") {
      throw new Error("Banco inesperado.");
    }

    UsuarioTeste = conexao.model("User", User.schema);

    const indices = await UsuarioTeste.collection.indexes();

    for (const nome of ["cpf_1", "email_1"]) {
      const indice = indices.find((item) => item.name === nome);

      if (
        !indice ||
        indice.unique !== true ||
        indice.partialFilterExpression !== undefined
      ) {
        throw new Error(`Índice inválido: ${nome}`);
      }
    }
  });

  afterEach(async () => {
    if (idsCriados.length > 0 && conexao?.readyState === 1) {
      await UsuarioTeste.deleteMany({
        _id: { $in: idsCriados },
      });
      idsCriados.length = 0;
    }
  });

  afterAll(async () => {
    if (conexao) {
      await conexao.close();
    }
  });

  it("rejeita CPF duplicado entre usuários ativos", async () => {
    await criarUsuario();

    await expect(
      criarUsuario({
        cpf: "52998224725",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rejeita e-mail duplicado entre usuários ativos", async () => {
    const email = `duplicado-${new mongoose.Types.ObjectId()}@example.com`;

    await criarUsuario({ email });

    await expect(
      criarUsuario({
        cpf: "11144477735",
        email,
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rejeita CPF pertencente a usuário desativado", async () => {
    const usuario = await criarUsuario({ ativo: false });

    expect(usuario.ativo).toBe(false);

    await expect(
      criarUsuario({
        cpf: usuario.cpf,
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rejeita e-mail pertencente a usuário desativado", async () => {
    const email = `inativo-${new mongoose.Types.ObjectId()}@example.com`;

    await criarUsuario({
      email,
      ativo: false,
    });

    await expect(
      criarUsuario({
        cpf: "11144477735",
        email,
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});

