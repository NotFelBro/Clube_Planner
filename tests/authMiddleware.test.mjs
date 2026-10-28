
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
  emitirAccessToken,
} = require("../src/services/authTokenService");

const {
  autenticar,
  autorizarRoles,
} = require("../src/middlewares/authMiddleware");

const userId = new mongoose.Types.ObjectId();
const sessionId = new mongoose.Types.ObjectId();

const segredoOriginal = process.env.JWT_ACCESS_SECRET;
const expiracaoOriginal =
  process.env.JWT_ACCESS_EXPIRES_IN;

let token;
let req;
let res;
let next;

function respostaSimulada() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function simularSessao(sessao) {
  return vi
    .spyOn(Session, "findOne")
    .mockReturnValue({
      lean: vi.fn().mockResolvedValue(sessao),
    });
}

function simularUsuario(usuario) {
  return vi
    .spyOn(User, "findOne")
    .mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(usuario),
      }),
    });
}

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = "a".repeat(96);
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";

  token = emitirAccessToken({ userId, sessionId });

  req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  res = respostaSimulada();
  next = vi.fn();

  simularSessao({
    _id: sessionId,
    userId,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
  });

  simularUsuario({
    _id: userId,
    role: "client",
    ativo: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();

  if (segredoOriginal === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET = segredoOriginal;
  }

  if (expiracaoOriginal === undefined) {
    delete process.env.JWT_ACCESS_EXPIRES_IN;
  } else {
    process.env.JWT_ACCESS_EXPIRES_IN =
      expiracaoOriginal;
  }
});

describe("Middleware de autenticação", () => {
  it("autoriza usuário com token e sessão válidos", async () => {
    await autenticar(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(req.auth).toEqual({
      userId: String(userId),
      sessionId: String(sessionId),
      role: "client",
    });

    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejeita requisição sem Authorization", async () => {
    delete req.headers.authorization;

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejeita formato de autenticação incorreto", async () => {
    req.headers.authorization = `Basic ${token}`;

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejeita token inválido", async () => {
    req.headers.authorization = "Bearer token-invalido";

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejeita sessão inexistente", async () => {
    Session.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejeita sessão revogada", async () => {
    await autenticar(req, res, next);

    expect(Session.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: null,
      })
    );
  });

  it("exige sessão não expirada", async () => {
    await autenticar(req, res, next);

    expect(Session.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: {
          $gt: expect.any(Date),
        },
      })
    );
  });

  it("rejeita usuário inexistente ou desativado", async () => {
    User.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("encaminha falhas do banco ao handler de erros", async () => {
    Session.findOne.mockImplementation(() => {
      throw new Error("Falha simulada no MongoDB");
    });

    await autenticar(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.any(Error)
    );

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("Middleware de autorização", () => {
  it("permite role autorizada", () => {
    req.auth = { role: "admin" };

    autorizarRoles("admin")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("retorna 403 para role sem permissão", () => {
    req.auth = { role: "client" };

    autorizarRoles("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retorna 401 se não houver autenticação", () => {
    autorizarRoles("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
