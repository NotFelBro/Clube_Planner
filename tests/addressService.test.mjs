
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
  adicionarEndereco,
  editarEndereco,
  definirEnderecoPrincipal,
  excluirEndereco,
} = addressService;

const enderecoBase = {
  cep: "13010000",
  logradouro: "Rua de Exemplo",
  numero: "100",
  complemento: "",
  bairro: "Centro",
  cidade: "Campinas",
  estado: "SP",
};

async function criarUsuario() {
  return User.create({
    nome: "Cliente Teste",
    email: "cliente@example.com",
    cpf: "52998224725",
    telefone: "11999999999",
    senhaHash: "hash-ficticio-para-teste",
  });
}

function obterUriDeTeste() {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_TEST_URI não configurada no .env."
    );
  }

  const url = new URL(uri);

  const nomeBanco = decodeURIComponent(
    url.pathname.replace(/^\//, "")
  );

  if (nomeBanco !== "clube_planner_test") {
    throw new Error(
      "Segurança: os testes só podem usar clube_planner_test."
    );
  }

  return uri;
}

beforeAll(async () => {
  const uri = obterUriDeTeste();

  await mongoose.connect(uri, {
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
    mongoose.connection.name === "clube_planner_test"
  ) {
    await User.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});


/**
 * Testes do serviço de endereços.
 */
describe("Serviço de endereços", () => {

  it("define o primeiro endereço como principal", async () => {
    const usuario = await criarUsuario();

    const enderecos = await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    expect(enderecos).toHaveLength(1);
    expect(enderecos[0].principal).toBe(true);
  });

  it("mantém o principal ao adicionar outro endereço", async () => {
    const usuario = await criarUsuario();

    await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const enderecos = await adicionarEndereco(
      usuario._id,
      {
        ...enderecoBase,
        numero: "200",
      }
    );

    expect(enderecos).toHaveLength(2);

    expect(
      enderecos.filter((e) => e.principal)
    ).toHaveLength(1);

    expect(enderecos[0].principal).toBe(true);
    expect(enderecos[1].principal).toBe(false);
  });

  it("permite trocar o endereço principal", async () => {
    const usuario = await criarUsuario();

    await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const cadastrados = await adicionarEndereco(
      usuario._id,
      {
        ...enderecoBase,
        numero: "200",
      }
    );

    const enderecos = await definirEnderecoPrincipal(
      usuario._id,
      cadastrados[1]._id
    );

    expect(enderecos[0].principal).toBe(false);
    expect(enderecos[1].principal).toBe(true);
  });

  it("permite editar um endereço sem alterar seu identificador", async () => {
    const usuario = await criarUsuario();

    const cadastrados = await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const enderecoId = cadastrados[0]._id;

    const enderecos = await editarEndereco(
      usuario._id,
      enderecoId,
      {
        ...enderecoBase,
        numero: "999",
      }
    );

    expect(
      enderecos[0]._id.toString()
    ).toBe(enderecoId.toString());

    expect(enderecos[0].numero).toBe("999");
    expect(enderecos[0].principal).toBe(true);
  });

  it("promove outro endereço quando o principal é excluído", async () => {
    const usuario = await criarUsuario();

    await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const cadastrados = await adicionarEndereco(
      usuario._id,
      {
        ...enderecoBase,
        numero: "200",
      }
    );

    const enderecos = await excluirEndereco(
      usuario._id,
      cadastrados[0]._id
    );

    expect(enderecos).toHaveLength(1);
    expect(enderecos[0].principal).toBe(true);
    expect(enderecos[0].numero).toBe("200");
  });

  it("permite excluir o último endereço", async () => {
    const usuario = await criarUsuario();

    const cadastrados = await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const enderecos = await excluirEndereco(
      usuario._id,
      cadastrados[0]._id
    );

    expect(enderecos).toHaveLength(0);
  });

  it("rejeita um CEP inválido", async () => {
    const usuario = await criarUsuario();

    await expect(
      adicionarEndereco(
        usuario._id,
        {
          ...enderecoBase,
          cep: "123",
        }
      )
    ).rejects.toThrow();
  });

  it("rejeita identificadores inválidos", async () => {
    await expect(
      adicionarEndereco(
        "id-invalido",
        enderecoBase
      )
    ).rejects.toThrow("Identificador inválido.");
  });

  it("preserva um único principal em alterações concorrentes", async () => {
    const usuario = await criarUsuario();

    await adicionarEndereco(
      usuario._id,
      enderecoBase
    );

    const cadastrados = await adicionarEndereco(
      usuario._id,
      {
        ...enderecoBase,
        numero: "200",
      }
    );

    await Promise.all([
      definirEnderecoPrincipal(
        usuario._id,
        cadastrados[0]._id
      ),
      definirEnderecoPrincipal(
        usuario._id,
        cadastrados[1]._id
      ),
    ]);

    const atualizado = await User.findById(
      usuario._id
    );

    expect(
      atualizado.enderecos.filter(
        (e) => e.principal
      )
    ).toHaveLength(1);
  });

});
