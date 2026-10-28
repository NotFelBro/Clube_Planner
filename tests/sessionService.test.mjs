
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import mongoose from "mongoose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const User = require("../src/models/User");
const Session = require("../src/models/session");

const {
  verificarAccessToken,
  calcularHashRefreshToken,
} = require("../src/services/authTokenService");

const {
  criarSessao,
} = require("../src/services/sessionService");

const userId = new mongoose.Types.ObjectId();

const ambienteOriginal = {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN:
    process.env.JWT_ACCESS_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_DAYS:
    process.env.REFRESH_TOKEN_EXPIRES_DAYS,
};

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = "a".repeat(96);
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.REFRESH_TOKEN_EXPIRES_DAYS = "7";

  vi.spyOn(User, "findOne").mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: userId,
        ativo: true,
      }),
    }),
  });

  vi.spyOn(Session, "create").mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();

  for (const [chave, valor] of Object.entries(
    ambienteOriginal
  )) {
    if (valor === undefined) {
      delete process.env[chave];
    } else {
      process.env[chave] = valor;
    }
  }
});

describe("Criação de sessões", () => {
  it("cria uma sessão para usuário ativo", async () => {
    const resultado = await criarSessao({ userId });

    expect(resultado.accessToken).toBeTypeOf("string");
    expect(resultado.refreshToken).toMatch(
      /^[a-f0-9]{96}$/
    );

    expect(resultado.sessionId).toMatch(
      /^[a-f0-9]{24}$/
    );

    expect(resultado.expiresAt).toBeInstanceOf(Date);

    expect(Session.create).toHaveBeenCalledOnce();
  });

  it("armazena somente o hash do refresh token", async () => {
    const resultado = await criarSessao({ userId });

    const documento = Session.create.mock.calls[0][0];

    expect(documento.refreshTokenHash).toBe(
      calcularHashRefreshToken(resultado.refreshToken)
    );

    expect(documento).not.toHaveProperty(
      "refreshToken"
    );
  });

  it("associa o access token à sessão criada", async () => {
    const resultado = await criarSessao({ userId });

    const payload = verificarAccessToken(
      resultado.accessToken
    );

    expect(payload).toEqual({
      userId: String(userId),
      sessionId: resultado.sessionId,
    });
  });

  it("define validade de sete dias", async () => {
    const inicio = Date.now();

    const resultado = await criarSessao({ userId });

    const fim = Date.now();

    const seteDias = 7 * 24 * 60 * 60 * 1000;

    expect(resultado.expiresAt.getTime()).toBeGreaterThanOrEqual(
      inicio + seteDias
    );

    expect(resultado.expiresAt.getTime()).toBeLessThanOrEqual(
      fim + seteDias
    );
  });

  it("rejeita usuário inexistente ou inativo", async () => {
    User.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      criarSessao({ userId })
    ).rejects.toThrow(
      "Usuário inexistente ou inativo."
    );

    expect(Session.create).not.toHaveBeenCalled();
  });

  it("rejeita identificador de usuário inválido", async () => {
    await expect(
      criarSessao({ userId: "invalido" })
    ).rejects.toThrow(
      "Identificador de usuário inválido."
    );

    expect(Session.create).not.toHaveBeenCalled();
  });

  it("rejeita configuração de expiração inválida", async () => {
    process.env.REFRESH_TOKEN_EXPIRES_DAYS = "0";

    await expect(
      criarSessao({ userId })
    ).rejects.toThrow(
      "REFRESH_TOKEN_EXPIRES_DAYS inválido."
    );

    expect(Session.create).not.toHaveBeenCalled();
  });

  it("não persiste sessão se a configuração JWT for inválida", async () => {
    process.env.JWT_ACCESS_SECRET = "inseguro";

    await expect(
      criarSessao({ userId })
    ).rejects.toThrow(
      "JWT_ACCESS_SECRET ausente ou inseguro."
    );

    expect(Session.create).not.toHaveBeenCalled();
  });
});
