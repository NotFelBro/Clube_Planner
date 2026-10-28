
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  emitirAccessToken,
  verificarAccessToken,
  gerarRefreshToken,
  calcularHashRefreshToken,
} = require("../src/services/authTokenService");

const SEGREDO_TESTE = "a".repeat(96);

const ambienteOriginal = {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN:
    process.env.JWT_ACCESS_EXPIRES_IN,
};

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = SEGREDO_TESTE;
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
});

afterEach(() => {
  if (ambienteOriginal.JWT_ACCESS_SECRET === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET =
      ambienteOriginal.JWT_ACCESS_SECRET;
  }

  if (
    ambienteOriginal.JWT_ACCESS_EXPIRES_IN === undefined
  ) {
    delete process.env.JWT_ACCESS_EXPIRES_IN;
  } else {
    process.env.JWT_ACCESS_EXPIRES_IN =
      ambienteOriginal.JWT_ACCESS_EXPIRES_IN;
  }
});

describe("Serviço de tokens de autenticação", () => {
  it("emite e valida um access token", () => {
    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();

    const token = emitirAccessToken({
      userId,
      sessionId,
    });

    const resultado = verificarAccessToken(token);

    expect(resultado).toEqual({
      userId: String(userId),
      sessionId: String(sessionId),
    });
  });

  it("rejeita token adulterado", () => {
    const token = emitirAccessToken({
      userId: new mongoose.Types.ObjectId(),
      sessionId: new mongoose.Types.ObjectId(),
    });

    const partes = token.split(".");
    const assinatura = partes[2];

    partes[2] =
      (assinatura[0] === "a" ? "b" : "a") +
      assinatura.slice(1);

    expect(() =>
      verificarAccessToken(partes.join("."))
    ).toThrow();
  });

  it("rejeita token com finalidade incorreta", () => {
    const token = jwt.sign(
      {
        tokenUse: "refresh",
        sid: String(new mongoose.Types.ObjectId()),
      },
      SEGREDO_TESTE,
      {
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: "clube-planner-api",
        audience: "clube-planner-client",
        subject: String(new mongoose.Types.ObjectId()),
      }
    );

    expect(() =>
      verificarAccessToken(token)
    ).toThrow("Access token inválido.");
  });

  it("rejeita access token expirado", () => {
    const token = jwt.sign(
      {
        tokenUse: "access",
        sid: String(new mongoose.Types.ObjectId()),
      },
      SEGREDO_TESTE,
      {
        algorithm: "HS256",
        expiresIn: -1,
        issuer: "clube-planner-api",
        audience: "clube-planner-client",
        subject: String(new mongoose.Types.ObjectId()),
      }
    );

    expect(() =>
      verificarAccessToken(token)
    ).toThrow();
  });

  it("rejeita configuração JWT insegura", () => {
    process.env.JWT_ACCESS_SECRET = "segredo-fraco";

    expect(() =>
      emitirAccessToken({
        userId: new mongoose.Types.ObjectId(),
        sessionId: new mongoose.Types.ObjectId(),
      })
    ).toThrow(
      "JWT_ACCESS_SECRET ausente ou inseguro."
    );
  });

  it("gera refresh tokens aleatórios e distintos", () => {
    const primeiro = gerarRefreshToken();
    const segundo = gerarRefreshToken();

    expect(primeiro).toMatch(/^[a-f0-9]{96}$/);
    expect(segundo).toMatch(/^[a-f0-9]{96}$/);
    expect(primeiro).not.toBe(segundo);
  });

  it("calcula hash determinístico do refresh token", () => {
    const token = gerarRefreshToken();

    const primeiroHash = calcularHashRefreshToken(token);
    const segundoHash = calcularHashRefreshToken(token);

    expect(primeiroHash).toMatch(/^[a-f0-9]{64}$/);
    expect(primeiroHash).toBe(segundoHash);
    expect(primeiroHash).not.toBe(token);
  });

  it("rejeita refresh token malformado", () => {
    expect(() =>
      calcularHashRefreshToken("token-invalido")
    ).toThrow("Refresh token inválido.");
  });
});
