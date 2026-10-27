
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
const Payment = require("../src/models/payment");

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (
    !uri ||
    new URL(uri).pathname !== "/clube_planner_test"
  ) {
    throw new Error("Banco de testes não autorizado.");
  }

  await mongoose.connect(uri);
  await Payment.init();
});

afterAll(async () => {
  await mongoose.disconnect();
});

const criarDados = (alteracoes = {}) => ({
  orderId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  provider: "mercado_pago",
  idempotencyKey: new mongoose.Types.ObjectId().toHexString(),
  metodo: "pix",
  valorCentavos: 2500,
  status: "criado",
  ...alteracoes,
});

describe("Modelo Payment", () => {
  it("aceita uma tentativa de pagamento válida", async () => {
    const payment = new Payment(criarDados());

    await expect(payment.validate()).resolves.toBeUndefined();
  });

  it("rejeita valores monetários inválidos", async () => {
    const payment = new Payment(
      criarDados({ valorCentavos: 10.5 })
    );

    await expect(payment.validate()).rejects.toThrow(
      "Valor de pagamento"
    );
  });

  it("rejeita pagamento aprovado sem data de aprovação", async () => {
    const payment = new Payment(
      criarDados({ status: "aprovado" })
    );

    await expect(payment.validate()).rejects.toThrow(
      "Pagamento aprovado exige data de aprovação."
    );
  });

  it("rejeita data de aprovação incompatível com o status", async () => {
    const payment = new Payment(
      criarDados({
        status: "pendente",
        aprovadoEm: new Date(),
      })
    );

    await expect(payment.validate()).rejects.toThrow(
      "Data de aprovação incompatível com o status."
    );
  });

  it("impede duplicação da chave de idempotência", async () => {
    const dados = criarDados();
    const idsCriados = [];

    try {
      const primeiro = await Payment.create(dados);
      idsCriados.push(primeiro._id);

      await expect(
        Payment.create({
          ...criarDados(),
          idempotencyKey: dados.idempotencyKey,
        })
      ).rejects.toMatchObject({
        code: 11000,
      });
    } finally {
      if (idsCriados.length > 0) {
        await Payment.deleteMany({
          _id: { $in: idsCriados },
        });
      }
    }
  });
});
