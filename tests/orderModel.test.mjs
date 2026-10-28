
import "dotenv/config";

import {
  describe,
  it,
  expect,
} from "vitest";

import mongoose from "mongoose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Order = require("../src/models/order");

function criarPedido(alteracoes = {}) {
  return new Order({
    userId: new mongoose.Types.ObjectId(),
    checkoutIdempotencyKey:
      new mongoose.Types.ObjectId().toHexString(),

    itens: [
  {
    lineId: "line_1",

    productId: new mongoose.Types.ObjectId(),
    variantId: new mongoose.Types.ObjectId(),

    nomeProduto: "Planner Semanal",
    sku: "PLANNER-001",
    atributos: { cor: "Azul" },

    quantidade: 2,
    precoUnitarioCentavos: 2500,
    subtotalCentavos: 5000,

    descontoAlocadoCentavos: 500,
    totalLiquidoCentavos: 4500,
  },
],

    enderecoEntrega: {
      cep: "13000000",
      logradouro: "Rua Exemplo",
      numero: "100",
      bairro: "Centro",
      cidade: "Campinas",
      estado: "SP",
    },

    subtotalCentavos: 5000,
    descontoCentavos: 500,
    freteCentavos: 1000,
    totalCentavos: 5500,

    status: "aguardando_pagamento",

    reserva: {
      status: "reservado",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },

    ...alteracoes,
  });
}

describe("Modelo Order", () => {
  it("aceita um pedido válido", async () => {
    const pedido = criarPedido();

    await expect(
      pedido.validate()
    ).resolves.toBeUndefined();
  });

  it("rejeita subtotal inconsistente", async () => {
    const pedido = criarPedido({
      subtotalCentavos: 4000,
    });

    await expect(
      pedido.validate()
    ).rejects.toThrow(
      "Subtotal diferente da soma dos itens."
    );
  });

  it("rejeita desconto superior ao subtotal", async () => {
    const pedido = criarPedido({
      descontoCentavos: 6000,
    });

    await expect(
      pedido.validate()
    ).rejects.toThrow(
      "Desconto superior ao subtotal."
    );
  });

  it("rejeita chave de idempotência curta", async () => {
    const pedido = criarPedido({
      checkoutIdempotencyKey: "abc",
    });

    await expect(
      pedido.validate()
    ).rejects.toThrow();
  });

  it("rejeita reserva com expiração inválida", async () => {
    const pedido = criarPedido({
      reserva: {
        status: "reservado",
        expiresAt: new Date(Date.now() - 60000),
      },
    });

    await expect(
      pedido.validate()
    ).rejects.toThrow(
      "A reserva deve expirar em até 15 minutos."
    );
  });
});
