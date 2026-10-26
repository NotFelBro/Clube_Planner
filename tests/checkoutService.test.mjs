
import "dotenv/config";

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";

import mongoose from "mongoose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const Product = require("../src/models/product");

const {
  executarTransacao,
  reservarEstoque,
} = require("../src/services/checkoutService");

let productId;
let variantId;

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (
    !uri ||
    new URL(uri).pathname !== "/clube_planner_test"
  ) {
    throw new Error("Banco de testes não autorizado.");
  }

  await mongoose.connect(uri);

  const categoriaId = new mongoose.Types.ObjectId();
  const sku = `TESTE-${new mongoose.Types.ObjectId()
    .toHexString()
    .toUpperCase()}`;

  const produto = await Product.create({
    nome: "Produto de teste transacional",
    slug: `produto-teste-${new mongoose.Types.ObjectId().toHexString()}`,
    descricao: "Produto temporário para testar a reserva de estoque.",
    categoriaId,
    imagens: [],
    variacoes: [
      {
        sku,
        atributos: {
          cor: "Azul",
        },
        precoCentavos: 2000,
        estoqueDisponivel: 5,
        estoqueReservado: 0,
        ativo: true,
      },
    ],
    ativo: true,
  });

  productId = produto._id;
  variantId = produto.variacoes[0]._id;
});

afterAll(async () => {
  try {
    if (productId) {
      await Product.deleteOne({ _id: productId });
    }
  } finally {
    await mongoose.disconnect();
  }
});

describe("Reserva transacional de estoque", () => {
  it("reserva duas unidades disponíveis", async () => {
    const resultado = await executarTransacao(
      (session) =>
        reservarEstoque({
          productId,
          variantId,
          quantidade: 2,
          session,
        })
    );

    expect(resultado.reservado).toBe(true);

    const produto = await Product.findById(productId);
    const variacao = produto.variacoes.id(variantId);

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("rejeita reserva acima do estoque disponível", async () => {
    await expect(
      executarTransacao((session) =>
        reservarEstoque({
          productId,
          variantId,
          quantidade: 10,
          session,
        })
      )
    ).rejects.toThrow(
      "Produto indisponível ou estoque insuficiente."
    );

    const produto = await Product.findById(productId);
    const variacao = produto.variacoes.id(variantId);

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("desfaz a reserva quando a transação falha", async () => {
    await expect(
      executarTransacao(async (session) => {
        await reservarEstoque({
          productId,
          variantId,
          quantidade: 1,
          session,
        });

        throw new Error("Falha simulada.");
      })
    ).rejects.toThrow("Falha simulada.");

    const produto = await Product.findById(productId);
    const variacao = produto.variacoes.id(variantId);

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("impede duas reservas concorrentes do mesmo estoque", async () => {
    const tentativas = Array.from({ length: 2 }, () =>
      executarTransacao((session) =>
        reservarEstoque({
          productId,
          variantId,
          quantidade: 3,
          session,
        })
      )
    );

    const resultados = await Promise.allSettled(tentativas);

    expect(
      resultados.filter((r) => r.status === "fulfilled")
    ).toHaveLength(1);

    expect(
      resultados.filter((r) => r.status === "rejected")
    ).toHaveLength(1);

    const produto = await Product.findById(productId);
    const variacao = produto.variacoes.id(variantId);

    expect(variacao.estoqueDisponivel).toBe(0);
    expect(variacao.estoqueReservado).toBe(5);
  });
});
