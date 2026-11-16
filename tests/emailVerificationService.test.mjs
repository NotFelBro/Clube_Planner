
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);

const User = require("../src/models/User.js");
const emailService = require(
  "../src/services/emailService.js"
);
const servico = require(
  "../src/services/emailVerificationService.js"
);

const enviarOriginal =
  emailService.enviarLinkVerificacao;

const segredoAnterior =
  process.env.EMAIL_CODE_SECRET;

const frontendAnterior =
  process.env.FRONTEND_URL;

const EMAIL = "cliente@example.com";
const SEGREDO = "a".repeat(64);
const TOKEN = "b".repeat(64);

function hashToken(token) {
  return crypto
    .createHmac("sha256", SEGREDO)
    .update(token)
    .digest("hex");
}

function criarUsuario() {
  return {
    _id: "507f1f77bcf86cd799439011",
    nome: "Cliente Teste",
    email: EMAIL,
    ativo: true,
    emailVerificado: false,
    verificacaoEmail: {
      codigoHash: null,
      expiraEm: null,
      ultimoEnvioEm: null,
      tentativas: 0,
    },
  };
}

function criarQuery(resultado) {
  return {
    select: vi.fn().mockResolvedValue(resultado),
  };
}

function mockarEnvio(usuario = criarUsuario()) {
  return vi
    .spyOn(User, "findOneAndUpdate")
    .mockReturnValue(criarQuery(usuario));
}

beforeEach(() => {
  process.env.EMAIL_CODE_SECRET = SEGREDO;
  process.env.FRONTEND_URL =
    "http://localhost:5173";

  emailService.enviarLinkVerificacao = vi
    .fn()
    .mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();

  emailService.enviarLinkVerificacao =
    enviarOriginal;

  if (segredoAnterior === undefined) {
    delete process.env.EMAIL_CODE_SECRET;
  } else {
    process.env.EMAIL_CODE_SECRET =
      segredoAnterior;
  }

  if (frontendAnterior === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL =
      frontendAnterior;
  }
});

describe("Verificação por link — validações", () => {
  it("rejeita e-mail inválido", async () => {
    await expect(
      servico.solicitarLink("invalido")
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("rejeita token incompleto", async () => {
    await expect(
      servico.confirmarLink("123456")
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("rejeita token de formato incorreto", async () => {
    await expect(
      servico.confirmarLink("z".repeat(64))
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("exige segredo de segurança válido", async () => {
    process.env.EMAIL_CODE_SECRET = "curto";

    await expect(
      servico.solicitarLink(EMAIL)
    ).rejects.toThrow("EMAIL_CODE_SECRET");
  });
});

describe("Verificação por link — envio", () => {
  it("responde genericamente para conta não elegível", async () => {
    mockarEnvio(null);

    const resposta = await servico.solicitarLink(
      EMAIL
    );

    expect(resposta.mensagem).toContain(
      "Se houver uma conta pendente"
    );

    expect(
      emailService.enviarLinkVerificacao
    ).not.toHaveBeenCalled();
  });

  it("envia link com token aleatório", async () => {
    mockarEnvio();

    await servico.solicitarLink(EMAIL);

    expect(
      emailService.enviarLinkVerificacao
    ).toHaveBeenCalledOnce();

    const [destinatario, endereco] =
      emailService.enviarLinkVerificacao
        .mock.calls[0];

    const url = new URL(endereco);
    const parametros = new URLSearchParams(
      url.hash.slice(1)
    );

    expect(destinatario).toBe(EMAIL);

    expect(url.origin).toBe(
      "http://localhost:5173"
    );

    expect(url.pathname).toBe(
      "/confirmar-email"
    );

    expect(parametros.get("token")).toMatch(
      /^[a-f0-9]{64}$/
    );

    expect(url.search).toBe("");
  });

  it("armazena hash, nunca token em texto puro", async () => {
    const consulta = mockarEnvio();

    await servico.solicitarLink(EMAIL);

    const url = new URL(
      emailService.enviarLinkVerificacao
        .mock.calls[0][1]
    );

    const token = new URLSearchParams(
      url.hash.slice(1)
    ).get("token");

    const atualizacao =
      consulta.mock.calls[0][1];

    const hashArmazenado =
      atualizacao.$set[
        "verificacaoEmail.codigoHash"
      ];

    expect(hashArmazenado).toBe(
      hashToken(token)
    );

    expect(hashArmazenado).not.toBe(token);
    expect(hashArmazenado).toMatch(
      /^[a-f0-9]{64}$/
    );
  });

  it("define validade de dez minutos", async () => {
    const consulta = mockarEnvio();

    const antes = Date.now();

    await servico.solicitarLink(EMAIL);

    const depois = Date.now();

    const atualizacao =
      consulta.mock.calls[0][1];

    const expiracao =
      atualizacao.$set[
        "verificacaoEmail.expiraEm"
      ];

    expect(
      expiracao.getTime()
    ).toBeGreaterThanOrEqual(
      antes + 600000
    );

    expect(
      expiracao.getTime()
    ).toBeLessThanOrEqual(
      depois + 600000
    );
  });

  it("limita reenvio a um por minuto", async () => {
    const consulta = mockarEnvio();

    const antes = Date.now();

    await servico.solicitarLink(EMAIL);

    const depois = Date.now();

    const filtro = consulta.mock.calls[0][0];

    const limite =
      filtro.$or[1][
        "verificacaoEmail.ultimoEnvioEm"
      ].$lte;

    expect(
      limite.getTime()
    ).toBeGreaterThanOrEqual(
      antes - 60000
    );

    expect(
      limite.getTime()
    ).toBeLessThanOrEqual(
      depois - 60000
    );
  });

  it("normaliza o e-mail antes da consulta", async () => {
    const consulta = mockarEnvio(null);

    await servico.solicitarLink(
      "  CLIENTE@EXAMPLE.COM  "
    );

    expect(
      consulta.mock.calls[0][0].email
    ).toBe(EMAIL);
  });

  it("restaura estado anterior quando SMTP falha", async () => {
    mockarEnvio();

    const atualizar = vi
      .spyOn(User, "updateOne")
      .mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

    emailService.enviarLinkVerificacao
      .mockRejectedValueOnce(
        new Error("SMTP indisponível")
      );

    vi.spyOn(
      console,
      "error"
    ).mockImplementation(() => {});

    await expect(
      servico.solicitarLink(EMAIL)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 503,
    });

    expect(atualizar).toHaveBeenCalledOnce();

    const [filtro, alteracoes] =
      atualizar.mock.calls[0];

    expect(filtro.emailVerificado).toBe(
      false
    );

    expect(
      alteracoes.$set[
        "verificacaoEmail.codigoHash"
      ]
    ).toBeNull();

    expect(
      alteracoes.$set[
        "verificacaoEmail.ultimoEnvioEm"
      ]
    ).toBeNull();
  });
});

describe("Verificação por link — confirmação", () => {
  it("rejeita token sem conta elegível", async () => {
    const consulta = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValue(null);

    await expect(
      servico.confirmarLink(TOKEN)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });

    expect(consulta).toHaveBeenCalledOnce();
  });

  it("consulta somente tokens não expirados", async () => {
    const consulta = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValue(null);

    await expect(
      servico.confirmarLink(TOKEN)
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    const filtro = consulta.mock.calls[0][0];

    expect(
      filtro["verificacaoEmail.codigoHash"]
    ).toBe(hashToken(TOKEN));

    expect(
      filtro["verificacaoEmail.expiraEm"].$gt
    ).toBeInstanceOf(Date);

    expect(
      filtro.emailVerificado
    ).toBe(false);

    expect(filtro.ativo).toBe(true);
  });

  it("ativa conta e remove token em uma operação", async () => {
    const usuario = {
      ...criarUsuario(),
      emailVerificado: true,
      emailVerificadoEm: new Date(),
    };

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValue(usuario);

    const resultado =
      await servico.confirmarLink(TOKEN);

    expect(resultado).toEqual(usuario);

    expect(atualizar).toHaveBeenCalledOnce();

    const [filtro, alteracoes] =
      atualizar.mock.calls[0];

    expect(
      filtro["verificacaoEmail.codigoHash"]
    ).toBe(hashToken(TOKEN));

    expect(
      alteracoes.$set.emailVerificado
    ).toBe(true);

    expect(
      alteracoes.$set.emailVerificadoEm
    ).toBeInstanceOf(Date);

    expect(
      alteracoes.$unset.verificacaoEmail
    ).toBe("");
  });

  it("não permite reutilizar token consumido", async () => {
    const usuario = {
      ...criarUsuario(),
      emailVerificado: true,
    };

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValueOnce(usuario)
      .mockResolvedValueOnce(null);

    const primeiro =
      await servico.confirmarLink(TOKEN);

    expect(
      primeiro.emailVerificado
    ).toBe(true);

    await expect(
      servico.confirmarLink(TOKEN)
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(atualizar).toHaveBeenCalledTimes(
      2
    );
  });

  it("não confirma se a atualização falhar", async () => {
    vi.spyOn(
      User,
      "findOneAndUpdate"
    ).mockRejectedValueOnce(
      new Error("Falha no banco")
    );

    await expect(
      servico.confirmarLink(TOKEN)
    ).rejects.toThrow("Falha no banco");
  });

  it("rejeita duas confirmações concorrentes", async () => {
    const usuario = {
      ...criarUsuario(),
      emailVerificado: true,
    };

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValueOnce(usuario)
      .mockResolvedValueOnce(null);

    const resultados = await Promise.allSettled([
      servico.confirmarLink(TOKEN),
      servico.confirmarLink(TOKEN),
    ]);

    expect(
      resultados.filter(
        (item) => item.status === "fulfilled"
      )
    ).toHaveLength(1);

    expect(
      resultados.filter(
        (item) => item.status === "rejected"
      )
    ).toHaveLength(1);

    expect(atualizar).toHaveBeenCalledTimes(
      2
    );
  });
});
