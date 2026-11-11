
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const User = require("../src/models/User.js");

const emailService = require(
  "../src/services/emailService.js"
);

const servico = require(
  "../src/services/emailVerificationService.js"
);

const enviarEmailOriginal =
  emailService.enviarCodigoVerificacao;

const SEGREDO_TESTE = "a".repeat(64);
const EMAIL = "cliente@example.com";
const CODIGO = "123456";

const segredoAnterior =
  process.env.EMAIL_CODE_SECRET;

function criarUsuarioSimulado() {
  return {
    _id: "507f1f77bcf86cd799439011",
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

beforeEach(() => {
  process.env.EMAIL_CODE_SECRET =
    SEGREDO_TESTE;

  emailService.enviarCodigoVerificacao =
    vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();

  emailService.enviarCodigoVerificacao =
    enviarEmailOriginal;

  if (segredoAnterior === undefined) {
    delete process.env.EMAIL_CODE_SECRET;
  } else {
    process.env.EMAIL_CODE_SECRET =
      segredoAnterior;
  }
});

describe("Verificação de e-mail — validações", () => {
  it("rejeita e-mail inválido no envio", async () => {
    await expect(
      servico.solicitarCodigo("invalido")
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("rejeita código com formato inválido", async () => {
    await expect(
      servico.confirmarCodigo(EMAIL, "123")
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("rejeita e-mail inválido na confirmação", async () => {
    await expect(
      servico.confirmarCodigo(
        "email-invalido",
        CODIGO
      )
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });
});

describe("Verificação de e-mail — envio", () => {
  it("retorna resposta genérica para conta não elegível", async () => {
    const consulta = vi
      .spyOn(User, "findOneAndUpdate")
      .mockReturnValue(criarQuery(null));

    const resposta =
      await servico.solicitarCodigo(EMAIL);

    expect(resposta.mensagem).toContain(
      "Se houver uma conta cadastrada"
    );

    expect(consulta).toHaveBeenCalledOnce();

    expect(
      emailService.enviarCodigoVerificacao
    ).not.toHaveBeenCalled();
  });

  it("envia um código de seis dígitos", async () => {
    const usuario = criarUsuarioSimulado();

    vi.spyOn(
      User,
      "findOneAndUpdate"
    ).mockReturnValue(criarQuery(usuario));

    const resposta =
      await servico.solicitarCodigo(EMAIL);

    expect(resposta.mensagem).toBeTruthy();

    expect(
      emailService.enviarCodigoVerificacao
    ).toHaveBeenCalledOnce();

    const [destinatario, codigo] =
      emailService.enviarCodigoVerificacao
        .mock.calls[0];

    expect(destinatario).toBe(EMAIL);
    expect(codigo).toMatch(/^\d{6}$/);
  });

  it("configura validade de dez minutos e limite de reenvio", async () => {
    const usuario = criarUsuarioSimulado();

    const consulta = vi
      .spyOn(User, "findOneAndUpdate")
      .mockReturnValue(criarQuery(usuario));

    const antes = Date.now();

    await servico.solicitarCodigo(EMAIL);

    const depois = Date.now();

    const [filtro, atualizacao] =
      consulta.mock.calls[0];

    const dataLimite =
      filtro.$or[1][
        "verificacaoEmail.ultimoEnvioEm"
      ].$lte;

    const expiraEm =
      atualizacao.$set[
        "verificacaoEmail.expiraEm"
      ];

    expect(
      atualizacao.$set[
        "verificacaoEmail.tentativas"
      ]
    ).toBe(0);

    expect(expiraEm.getTime()).toBeGreaterThanOrEqual(
      antes + 10 * 60 * 1000
    );

    expect(expiraEm.getTime()).toBeLessThanOrEqual(
      depois + 10 * 60 * 1000
    );

    expect(dataLimite.getTime()).toBeGreaterThanOrEqual(
      antes - 60 * 1000
    );

    expect(dataLimite.getTime()).toBeLessThanOrEqual(
      depois - 60 * 1000
    );
  });

  it("restaura o estado anterior se o SMTP falhar", async () => {
    const usuario = criarUsuarioSimulado();

    vi.spyOn(
      User,
      "findOneAndUpdate"
    ).mockReturnValue(criarQuery(usuario));

    const atualizar = vi
      .spyOn(User, "updateOne")
      .mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

    emailService.enviarCodigoVerificacao
      .mockRejectedValue(
        new Error("Falha simulada do SMTP")
      );

    const erroConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      servico.solicitarCodigo(EMAIL)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 503,
    });

    expect(atualizar).toHaveBeenCalledOnce();

    const [filtro, alteracoes] =
      atualizar.mock.calls[0];

    expect(filtro.emailVerificado).toBe(false);

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

    expect(erroConsole).toHaveBeenCalled();
  });
});

describe("Verificação de e-mail — confirmação", () => {
  it("rejeita conta inexistente ou já verificada", async () => {
    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(null));

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("rejeita código expirado", async () => {
    const usuario = criarUsuarioSimulado();

    usuario.verificacaoEmail.codigoHash =
      "a".repeat(32) + ":" + "b".repeat(64);

    usuario.verificacaoEmail.expiraEm =
      new Date(Date.now() - 1000);

    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });
  });

  it("bloqueia após cinco tentativas", async () => {
    const usuario = criarUsuarioSimulado();

    usuario.verificacaoEmail.codigoHash =
      "a".repeat(32) + ":" + "b".repeat(64);

    usuario.verificacaoEmail.expiraEm =
      new Date(Date.now() + 600000);

    usuario.verificacaoEmail.tentativas = 5;

    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 429,
    });
  });

  it("rejeita reserva simultânea da mesma tentativa", async () => {
    const usuario = criarUsuarioSimulado();

    usuario.verificacaoEmail.codigoHash =
      "a".repeat(32) + ":" + "b".repeat(64);

    usuario.verificacaoEmail.expiraEm =
      new Date(Date.now() + 600000);

    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    vi.spyOn(
      User,
      "findOneAndUpdate"
    ).mockResolvedValue(null);

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 409,
    });
  });
});


describe("Verificação de e-mail — confirmação bem-sucedida", () => {
  const crypto = require("node:crypto");

  function gerarHashValido(codigo) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
      .createHmac(
        "sha256",
        process.env.EMAIL_CODE_SECRET
      )
      .update(`${salt}:${codigo}`, "utf8")
      .digest("hex");

    return `${salt}:${hash}`;
  }

  function criarUsuarioComCodigoValido() {
    const usuario = criarUsuarioSimulado();

    usuario.verificacaoEmail.codigoHash =
      gerarHashValido(CODIGO);

    usuario.verificacaoEmail.expiraEm =
      new Date(Date.now() + 10 * 60 * 1000);

    usuario.verificacaoEmail.tentativas = 0;

    return usuario;
  }

  it("confirma um código correto e verifica a conta", async () => {
    const usuario = criarUsuarioComCodigoValido();

    const buscar = vi
      .spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValueOnce({
        ...usuario,
        verificacaoEmail: {
          ...usuario.verificacaoEmail,
          tentativas: 1,
        },
      })
      .mockResolvedValueOnce({
        ...usuario,
        emailVerificado: true,
        emailVerificadoEm: new Date(),
      });

    const resultado = await servico.confirmarCodigo(
      EMAIL,
      CODIGO
    );

    expect(resultado).toEqual({
      mensagem: "E-mail verificado com sucesso.",
    });

    expect(buscar).toHaveBeenCalledOnce();
    expect(atualizar).toHaveBeenCalledTimes(2);

    const [filtroReserva, atualizacaoReserva] =
      atualizar.mock.calls[0];

    expect(filtroReserva.emailVerificado).toBe(false);

    expect(
      atualizacaoReserva.$inc[
        "verificacaoEmail.tentativas"
      ]
    ).toBe(1);

    const [filtroConfirmacao, atualizacaoConfirmacao] =
      atualizar.mock.calls[1];

    expect(filtroConfirmacao.emailVerificado).toBe(false);

    expect(
      atualizacaoConfirmacao.$set.emailVerificado
    ).toBe(true);

    expect(
      atualizacaoConfirmacao.$set.emailVerificadoEm
    ).toBeInstanceOf(Date);

    expect(
      atualizacaoConfirmacao.$unset.verificacaoEmail
    ).toBe("");
  });

  it("não permite reutilizar um código após a confirmação", async () => {
    const usuario = criarUsuarioComCodigoValido();

    let contaVerificada = false;

    const buscar = vi
      .spyOn(User, "findOne")
      .mockImplementation(() => {
        return criarQuery(
          contaVerificada ? null : usuario
        );
      });

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockImplementation(async (filtro, alteracoes) => {
        if (contaVerificada) {
          return null;
        }

        if (alteracoes.$inc) {
          return {
            ...usuario,
            verificacaoEmail: {
              ...usuario.verificacaoEmail,
              tentativas: 1,
            },
          };
        }

        if (
          alteracoes.$set?.emailVerificado === true
        ) {
          contaVerificada = true;

          return {
            ...usuario,
            emailVerificado: true,
            emailVerificadoEm: new Date(),
          };
        }

        return null;
      });

    const primeiraConfirmacao =
      await servico.confirmarCodigo(
        EMAIL,
        CODIGO
      );

    expect(primeiraConfirmacao.mensagem).toBe(
      "E-mail verificado com sucesso."
    );

    expect(contaVerificada).toBe(true);

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
    });

    expect(buscar).toHaveBeenCalledTimes(2);

    // A segunda tentativa não deve realizar
    // nenhuma nova atualização no banco.
    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it("rejeita código incorreto e contabiliza a tentativa", async () => {
    const usuario = criarUsuarioComCodigoValido();

    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValue({
        ...usuario,
        verificacaoEmail: {
          ...usuario.verificacaoEmail,
          tentativas: 1,
        },
      });

    await expect(
      servico.confirmarCodigo(EMAIL, "999999")
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 400,
      message: "Código inválido.",
    });

    expect(atualizar).toHaveBeenCalledOnce();

    expect(
      atualizar.mock.calls[0][1].$inc[
        "verificacaoEmail.tentativas"
      ]
    ).toBe(1);
  });

  it("não confirma se a atualização final falhar", async () => {
    const usuario = criarUsuarioComCodigoValido();

    vi.spyOn(User, "findOne")
      .mockReturnValue(criarQuery(usuario));

    const atualizar = vi
      .spyOn(User, "findOneAndUpdate")
      .mockResolvedValueOnce({
        ...usuario,
        verificacaoEmail: {
          ...usuario.verificacaoEmail,
          tentativas: 1,
        },
      })
      .mockResolvedValueOnce(null);

    await expect(
      servico.confirmarCodigo(EMAIL, CODIGO)
    ).rejects.toMatchObject({
      name: "EmailVerificationError",
      statusCode: 409,
    });

    expect(atualizar).toHaveBeenCalledTimes(2);
  });
});
