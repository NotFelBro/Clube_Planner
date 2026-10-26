
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
} = require("../src/services/checkoutService");

let couponId;
let userId;
let orderId;

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (
    !uri ||
    new URL(uri).pathname !== "/clube_planner_test"
  ) {
    throw new Error(
      "Banco de testes não autorizado."
    );
  }

  await mongoose.connect(uri);

  // Garante que o índice único do registro exista.
  await CouponRedemption.init();

  userId = new mongoose.Types.ObjectId();
  orderId = new mongoose.Types.ObjectId();

  const agora = Date.now();

  const cupom = await Coupon.create({
    codigo: `TESTE${new mongoose.Types.ObjectId().toHexString()}`,
    tipo: "percentual",
    valor: 10,
    pedidoMinimoCentavos: 1000,
    limiteUsos: 2,
    limiteUsosPorUsuario: 1,
    inicioEm: new Date(agora - 60000),
    expiraEm: new Date(agora + 3600000),
    ativo: true,
  });

  couponId = cupom._id;
});

afterAll(async () => {
  try {
    if (couponId) {
      await CouponRedemption.deleteMany({ couponId });
      await Coupon.deleteOne({ _id: couponId });
    }
  } finally {
    await mongoose.disconnect();
  }
});

describe("Reserva transacional de cupons", () => {
  it("reserva um cupom válido", async () => {
    const resultado = await executarTransacao(
      (session) =>
        reservarCupom({
          couponId,
          userId,
          orderId,
          subtotalCentavos: 2000,
          session,
        })
    );

    expect(resultado.reservado).toBe(true);
    expect(resultado.reutilizado).toBe(false);

    const cupom = await Coupon.findById(couponId);

    expect(cupom.usosReservados).toBe(1);
    expect(cupom.usosRealizados).toBe(0);

    const reserva = await CouponRedemption.findOne({
      couponId,
      orderId,
    });

    expect(reserva).not.toBeNull();
    expect(reserva.status).toBe("reserved");
  });

  it("rejeita utilização acima do limite por usuário", async () => {
    const outroPedidoId = new mongoose.Types.ObjectId();

    await expect(
      executarTransacao((session) =>
        reservarCupom({
          couponId,
          userId,
          orderId: outroPedidoId,
          subtotalCentavos: 2000,
          session,
        })
      )
    ).rejects.toThrow(
      "Limite de utilizações por usuário"
    );

    const cupom = await Coupon.findById(couponId);

    expect(cupom.usosReservados).toBe(1);
  });

  it("impede reservas concorrentes acima do limite global", async () => {
    const agora = Date.now();

    const cupom = await Coupon.create({
      codigo: `CONCORRENTE${new mongoose.Types.ObjectId().toHexString()}`,
      tipo: "percentual",
      valor: 10,
      pedidoMinimoCentavos: 0,
      limiteUsos: 1,
      limiteUsosPorUsuario: 1,
      inicioEm: new Date(agora - 60000),
      expiraEm: new Date(agora + 3600000),
      ativo: true,
    });

    try {
      const tentativas = Array.from(
        { length: 2 },
        () => {
          const usuario = new mongoose.Types.ObjectId();
          const pedido = new mongoose.Types.ObjectId();

          return executarTransacao((session) =>
            reservarCupom({
              couponId: cupom._id,
              userId: usuario,
              orderId: pedido,
              subtotalCentavos: 2000,
              session,
            })
          );
        }
      );

      const resultados = await Promise.allSettled(
        tentativas
      );

      const aprovadas = resultados.filter(
        (r) => r.status === "fulfilled"
      );

      const rejeitadas = resultados.filter(
        (r) => r.status === "rejected"
      );

      expect(aprovadas).toHaveLength(1);
      expect(rejeitadas).toHaveLength(1);

      const atualizado = await Coupon.findById(
        cupom._id
      );

      expect(atualizado.usosReservados).toBe(1);
      expect(atualizado.usosRealizados).toBe(0);

      const reservas = await CouponRedemption.find({
        couponId: cupom._id,
      });

      expect(reservas).toHaveLength(1);
    } finally {
      await CouponRedemption.deleteMany({
        couponId: cupom._id,
      });

      await Coupon.deleteOne({
        _id: cupom._id,
      });
    }
  });

  it("não duplica a reserva do mesmo pedido", async () => {
    const agora = Date.now();

    const cupom = await Coupon.create({
      codigo: `IDEMP${new mongoose.Types.ObjectId().toHexString()}`,
      tipo: "percentual",
      valor: 10,
      pedidoMinimoCentavos: 0,
      limiteUsos: 1,
      limiteUsosPorUsuario: 1,
      inicioEm: new Date(agora - 60000),
      expiraEm: new Date(agora + 3600000),
      ativo: true,
    });

    const usuario = new mongoose.Types.ObjectId();
    const pedido = new mongoose.Types.ObjectId();

    try {
      const primeira = await executarTransacao(
        (session) =>
          reservarCupom({
            couponId: cupom._id,
            userId: usuario,
            orderId: pedido,
            subtotalCentavos: 2000,
            session,
          })
      );

      const segunda = await executarTransacao(
        (session) =>
          reservarCupom({
            couponId: cupom._id,
            userId: usuario,
            orderId: pedido,
            subtotalCentavos: 2000,
            session,
          })
      );

      expect(primeira.reutilizado).toBe(false);
      expect(segunda.reutilizado).toBe(true);

      expect(String(segunda.redemptionId)).toBe(
        String(primeira.redemptionId)
      );

      const atualizado = await Coupon.findById(
        cupom._id
      );

      expect(atualizado.usosReservados).toBe(1);
      expect(atualizado.usosRealizados).toBe(0);

      const reservas = await CouponRedemption.find({
        couponId: cupom._id,
        orderId: pedido,
      });

      expect(reservas).toHaveLength(1);
    } finally {
      await CouponRedemption.deleteMany({
        couponId: cupom._id,
      });

      await Coupon.deleteOne({
        _id: cupom._id,
      });
    }
  });

  it("desfaz a reserva se a transação falhar", async () => {
    const outroUsuarioId = new mongoose.Types.ObjectId();
    const outroPedidoId = new mongoose.Types.ObjectId();

    await expect(
      executarTransacao(async (session) => {
        await reservarCupom({
          couponId,
          userId: outroUsuarioId,
          orderId: outroPedidoId,
          subtotalCentavos: 2000,
          session,
        });

        throw new Error("Falha simulada.");
      })
    ).rejects.toThrow("Falha simulada.");

    const cupom = await Coupon.findById(couponId);

    expect(cupom.usosReservados).toBe(1);

    const reserva = await CouponRedemption.findOne({
      orderId: outroPedidoId,
    });

    expect(reserva).toBeNull();
  });
});
