
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";

import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../src/models/User.js";
import addressService from "../src/services/addressService.js";

dotenv.config({ path: ".env" });

const {
  obterEnderecoParaCheckout,
} = addressService;

const enderecoBase = {
  cep: "13010000",
  logradouro: "Rua de Exemplo",
  numero: "100",
  complemento: "",
  bairro: "Centro",
  cidade: "Campinas",
  estado: "SP",
  principal: true,
};

const usuariosCriados = [];

function obterUriDeTeste() {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error("MONGODB_TEST_URI não configurada.");
  }

  const url = new URL(uri);

  const banco = decodeURIComponent(
    url.pathname.replace(/^\//, "")
  );

  if (banco !== "clube_planner_test") {
    throw new Error(
      "Banco de testes não autorizado."
    );
  }

  return uri;
}



async function criarUsuario({
  ativo = true,
  comEndereco = true,
} = {}) {
  const usuario = await User.create({
    nome: "Cliente Checkout Teste",

    email: `checkout-${new mongoose.Types.ObjectId()}@example.com`,

    cpf: "52998224725",

    telefone: "11999999999",

    senhaHash: "hash-ficticio-para-teste",

    ativo,

    enderecos: comEndereco
      ? [
          {
            ...enderecoBase,
            principal: true,
          },
        ]
      : [],
  });

  usuariosCriados.push(usuario._id);

  if (
    comEndereco &&
    usuario.enderecos.length !== 1
  ) {
    throw new Error(
      "Falha na preparação do usuário de teste: endereço ausente."
    );
  }

  return usuario;
}


beforeAll(async () => {
  if (typeof obterEnderecoParaCheckout !== "function") {
    throw new Error(
      "A função obterEnderecoParaCheckout não foi exportada."
    );
  }

  await mongoose.connect(obterUriDeTeste(), {
    serverSelectionTimeoutMS: 5000,
  });

  if (mongoose.connection.name !== "clube_planner_test") {
    await mongoose.disconnect();
    throw new Error("Conexão com banco inesperado.");
  }

  await User.init();
}, 30000);


afterEach(async () => {
  if (
    mongoose.connection.readyState === 1 &&
    mongoose.connection.name === "clube_planner_test" &&
    usuariosCriados.length > 0
  ) {
    await User.deleteMany({
      _id: { $in: usuariosCriados },
    });

    usuariosCriados.length = 0;
  }
});


afterAll(async () => {
  await mongoose.disconnect();
});

async function executarComSessao(operacao) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(
      async () => operacao(session)
    );
  } finally {
    await session.endSession();
  }
}

describe("Endereço no checkout", () => {
  it("retorna o endereço pertencente ao usuário", async () => {
    const usuario = await criarUsuario();
    const enderecoId = usuario.enderecos[0]._id;

    const resultado = await executarComSessao(
      (session) =>
        obterEnderecoParaCheckout({
          userId: usuario._id,
          enderecoId,
          session,
        })
    );

    expect(resultado.cep).toBe("13010000");
    expect(resultado.numero).toBe("100");
    expect(resultado.estado).toBe("SP");
  });

  it("impede acesso ao endereço de outro usuário", async () => {
    const usuario = await criarUsuario();

    const outroEnderecoId =
      new mongoose.Types.ObjectId();

    await expect(
      executarComSessao((session) =>
        obterEnderecoParaCheckout({
          userId: usuario._id,
          enderecoId: outroEnderecoId,
          session,
        })
      )
    ).rejects.toThrow(
      "Endereço não encontrado para este usuário."
    );
  });

  it("rejeita usuário inativo", async () => {
    const usuario = await criarUsuario({
      ativo: false,
    });

    await expect(
      executarComSessao((session) =>
        obterEnderecoParaCheckout({
          userId: usuario._id,
          enderecoId: usuario.enderecos[0]._id,
          session,
        })
      )
    ).rejects.toThrow();
  });

  it("rejeita endereço inexistente", async () => {
    const usuario = await criarUsuario({
      comEndereco: false,
    });

    await expect(
      executarComSessao((session) =>
        obterEnderecoParaCheckout({
          userId: usuario._id,
          enderecoId: new mongoose.Types.ObjectId(),
          session,
        })
      )
    ).rejects.toThrow();
  });

  it("rejeita identificadores inválidos", async () => {
    await expect(
      obterEnderecoParaCheckout({
        userId: "invalido",
        enderecoId: "invalido",
        session: {},
      })
    ).rejects.toThrow("Identificador inválido.");
  });

  it("exige sessão MongoDB", async () => {
    const usuario = await criarUsuario();

    await expect(
      obterEnderecoParaCheckout({
        userId: usuario._id,
        enderecoId: usuario.enderecos[0]._id,
      })
    ).rejects.toThrow(
      "Sessão MongoDB obrigatória."
    );
  });

  it("retorna somente os campos necessários ao pedido", async () => {
    const usuario = await criarUsuario();

    const resultado = await executarComSessao(
      (session) =>
        obterEnderecoParaCheckout({
          userId: usuario._id,
          enderecoId: usuario.enderecos[0]._id,
          session,
        })
    );

    expect(Object.keys(resultado).sort()).toEqual(
      [
        "cep",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "estado",
      ].sort()
    );

    expect(resultado).not.toHaveProperty("_id");
    expect(resultado).not.toHaveProperty("principal");
  });
});
