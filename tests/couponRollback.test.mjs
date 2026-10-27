
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

const Coupon = require("../src/models/coupons");
const CouponRedemption = require(
  "../src/models/couponRedemption"
);

const {
  executarTransacao,
  reservarCupom,
  consumirCupom,
  liberarCupom,
} = require("../src/services/checkoutService");

// Conexão exclusiva com o banco de testes.
beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (
    !uri ||
    new URL(uri).pathname !== "/clube_planner_test"
  ) {
    throw new Error("Banco de testes não autorizado.");
  }

  await mongoose.connect(uri);
  await CouponRedemption.init();
});

afterAll(async () => {
  await mongoose.disconnect();
});

// Cada teste cria seu próprio cupom e reserva.
async function criarCenario() {
  const agora = Date.now();

  const cupom = await Coupon.create({
    codigo: `ROLLBACK${new mongoose.Types.ObjectId().toHexString()}`,
    tipo: "percentual",
    valor: 10,
    pedidoMinimoCentavos: 0,
    limiteUsos: 5,
    limiteUsosPorUsuario: 2,
    inicioEm: new Date(agora - 60000),
    expiraEm: new Date(agora + 3600000),
    ativo: true,
  });

  const reserva = await executarTransacao((session) =>
    reservarCupom({
      couponId: cupom._id,
      userId: new mongoose.Types.ObjectId(),
      orderId: new mongoose.Types.ObjectId(),
      subtotalCentavos: 2000,
      session,
    })
  );

  return {
    couponId: cupom._id,
    redemptionId: reserva.redemptionId,
  };
}

async function limparCenario(couponId) {
  if (!couponId) return;

  await CouponRedemption.deleteMany({ couponId });
  await Coupon.deleteOne({ _id: couponId });
}

describe("Rollback transacional de cupons", () => {
  it("desfaz o consumo quando a transação falha", async () => {
    const { couponId, redemptionId } =
      await criarCenario();

    try {
      const antes = await Coupon.findById(couponId);

      expect(antes.usosReservados).toBe(1);
      expect(antes.usosRealizados).toBe(0);

      await expect(
        executarTransacao(async (session) => {
          await consumirCupom({
            redemptionId,
            session,
          });

          // Simula falha antes do commit.
          throw new Error("Falha simulada no consumo.");
        })
      ).rejects.toThrow("Falha simulada no consumo.");

      const cupom = await Coupon.findById(couponId);
      const reserva =
        await CouponRedemption.findById(redemptionId);

      expect(reserva.status).toBe("reserved");
      expect(reserva.consumedAt).toBeNull();
      expect(reserva.releasedAt).toBeNull();

      expect(cupom.usosReservados).toBe(1);
      expect(cupom.usosRealizados).toBe(0);

      // Verifica se a reserva pode ser consumida depois.
      const resultado = await executarTransacao(
        (session) =>
          consumirCupom({
            redemptionId,
            session,
          })
      );

      expect(resultado.status).toBe("consumed");

      const atualizado = await Coupon.findById(
        couponId
      );

      expect(atualizado.usosReservados).toBe(0);
      expect(atualizado.usosRealizados).toBe(1);
    } finally {
      await limparCenario(couponId);
    }
  });

  it("desfaz a liberação quando a transação falha", async () => {
    const { couponId, redemptionId } =
      await criarCenario();

    try {
      const antes = await Coupon.findById(couponId);

      expect(antes.usosReservados).toBe(1);
      expect(antes.usosRealizados).toBe(0);

      await expect(
        executarTransacao(async (session) => {
          await liberarCupom({
            redemptionId,
            session,
          });

          // Simula falha antes do commit.
          throw new Error("Falha simulada na liberação.");
        })
      ).rejects.toThrow(
        "Falha simulada na liberação."
      );

      const cupom = await Coupon.findById(couponId);
      const reserva =
        await CouponRedemption.findById(redemptionId);

      expect(reserva.status).toBe("reserved");
      expect(reserva.consumedAt).toBeNull();
      expect(reserva.releasedAt).toBeNull();

      expect(cupom.usosReservados).toBe(1);
      expect(cupom.usosRealizados).toBe(0);

      // Verifica se a reserva pode ser liberada depois.
      const resultado = await executarTransacao(
        (session) =>
          liberarCupom({
            redemptionId,
            session,
          })
      );

      expect(resultado.status).toBe("released");

      const atualizado = await Coupon.findById(
        couponId
      );

      expect(atualizado.usosReservados).toBe(0);
      expect(atualizado.usosRealizados).toBe(0);
    } finally {
      await limparCenario(couponId);
    }
  });
});
