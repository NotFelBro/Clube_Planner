
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

// Cada teste cria seu próprio cupom.
async function criarCenario() {
  const agora = Date.now();

  const cupom = await Coupon.create({
    codigo: `CICLO${new mongoose.Types.ObjectId().toHexString()}`,
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

describe("Ciclo de vida de cupons", () => {
  it("consome uma reserva e atualiza os contadores", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      const resultado = await executarTransacao(
        (session) =>
          consumirCupom({ redemptionId, session })
      );

      expect(resultado.status).toBe("consumed");
      expect(resultado.reutilizado).toBe(false);

      const cupom = await Coupon.findById(couponId);
      const reserva = await CouponRedemption.findById(
        redemptionId
      );

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(1);
      expect(reserva.status).toBe("consumed");
      expect(reserva.consumedAt).not.toBeNull();
    } finally {
      await limparCenario(couponId);
    }
  });

  it("não consome duas vezes a mesma reserva", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      await executarTransacao((session) =>
        consumirCupom({ redemptionId, session })
      );

      const repeticao = await executarTransacao(
        (session) =>
          consumirCupom({ redemptionId, session })
      );

      expect(repeticao.reutilizado).toBe(true);

      const cupom = await Coupon.findById(couponId);

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(1);
    } finally {
      await limparCenario(couponId);
    }
  });


it("impede consumo e liberação simultâneos da mesma reserva", async () => {
  const { couponId, redemptionId } = await criarCenario();

  try {
    const resultados = await Promise.allSettled([
      executarTransacao((session) =>
        consumirCupom({ redemptionId, session })
      ),
      executarTransacao((session) =>
        liberarCupom({ redemptionId, session })
      ),
    ]);

    const aprovadas = resultados.filter(
      (resultado) => resultado.status === "fulfilled"
    );

    const rejeitadas = resultados.filter(
      (resultado) => resultado.status === "rejected"
    );

    // Apenas uma transição pode prevalecer.
    expect(aprovadas).toHaveLength(1);
    expect(rejeitadas).toHaveLength(1);

    const cupom = await Coupon.findById(couponId);
    const reserva = await CouponRedemption.findById(
      redemptionId
    );

    expect(cupom.usosReservados).toBe(0);

    if (reserva.status === "consumed") {
      expect(cupom.usosRealizados).toBe(1);
      expect(reserva.consumedAt).not.toBeNull();
      expect(reserva.releasedAt).toBeNull();
    } else if (reserva.status === "released") {
      expect(cupom.usosRealizados).toBe(0);
      expect(reserva.releasedAt).not.toBeNull();
      expect(reserva.consumedAt).toBeNull();
    } else {
      throw new Error(
        `Estado inesperado da reserva: ${reserva.status}`
      );
    }
  } finally {
    await limparCenario(couponId);
  }
});


  it("libera uma reserva sem consumir o cupom", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      const resultado = await executarTransacao(
        (session) =>
          liberarCupom({ redemptionId, session })
      );

      expect(resultado.status).toBe("released");

      const cupom = await Coupon.findById(couponId);
      const reserva = await CouponRedemption.findById(
        redemptionId
      );

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(0);
      expect(reserva.status).toBe("released");
      expect(reserva.releasedAt).not.toBeNull();
    } finally {
      await limparCenario(couponId);
    }
  });

  it("não libera duas vezes a mesma reserva", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      await executarTransacao((session) =>
        liberarCupom({ redemptionId, session })
      );

      const repeticao = await executarTransacao(
        (session) =>
          liberarCupom({ redemptionId, session })
      );

      expect(repeticao.reutilizado).toBe(true);

      const cupom = await Coupon.findById(couponId);

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(0);
    } finally {
      await limparCenario(couponId);
    }
  });

  it("impede consumir uma reserva já liberada", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      await executarTransacao((session) =>
        liberarCupom({ redemptionId, session })
      );

      await expect(
        executarTransacao((session) =>
          consumirCupom({ redemptionId, session })
        )
      ).rejects.toThrow(
        "Uma reserva liberada não pode ser consumida."
      );

      const cupom = await Coupon.findById(couponId);

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(0);
    } finally {
      await limparCenario(couponId);
    }
  });

  it("impede liberar uma reserva já consumida", async () => {
    const { couponId, redemptionId } = await criarCenario();

    try {
      await executarTransacao((session) =>
        consumirCupom({ redemptionId, session })
      );

      await expect(
        executarTransacao((session) =>
          liberarCupom({ redemptionId, session })
        )
      ).rejects.toThrow(
        "Uma reserva consumida não pode ser liberada."
      );

      const cupom = await Coupon.findById(couponId);

      expect(cupom.usosReservados).toBe(0);
      expect(cupom.usosRealizados).toBe(1);
    } finally {
      await limparCenario(couponId);
    }
  });
});
