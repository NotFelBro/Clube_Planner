
import {
  describe,
  it,
  expect,
} from "vitest";

import "dotenv/config";

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ============================================================
// DM-USER-01-MIG — Testes automatizados
// ============================================================

const diretorioAtual = dirname(
  fileURLToPath(import.meta.url)
);

const raizProjeto = resolve(diretorioAtual, "..");

const caminhoScript = resolve(
  raizProjeto,
  "scripts/migrations/migrate-user-unique-indexes.mjs"
);

// ============================================================
// 1. Execução isolada do script
// ============================================================

function executarMigracao({
  uri = process.env.MONGODB_TEST_URI,
  argumentos = ["--check"],
} = {}) {
  const ambiente = {
    ...process.env,

    // Impede que dotenv recupere a variável do arquivo .env
    // quando o teste deseja simular uma URI ausente.
    MONGODB_TEST_URI: uri ?? "",
  };

  return spawnSync(
    process.execPath,
    [caminhoScript, ...argumentos],
    {
      cwd: raizProjeto,
      env: ambiente,
      encoding: "utf8",
      timeout: 15000,
    }
  );
}

// ============================================================
// 2. Testes de segurança
// ============================================================

describe("DM-USER-01-MIG — Segurança", () => {
  it("rejeita ausência da URI de testes", () => {
    const resultado = executarMigracao({
      uri: "",
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "MONGODB_TEST_URI não configurada"
    );
  });

  it("rejeita conexão com banco de desenvolvimento", () => {
    const resultado = executarMigracao({
      uri: "mongodb://127.0.0.1:27017/clube_planner",
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Destino MongoDB não autorizado"
    );
  });

  it("rejeita conexão com outro servidor", () => {
    const resultado = executarMigracao({
      uri:
        "mongodb://192.168.1.10:27017/clube_planner_test",
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Destino MongoDB não autorizado"
    );
  });

  it("rejeita parâmetros de conexão desconhecidos", () => {
    const resultado = executarMigracao({
      uri:
        "mongodb://127.0.0.1:27017/clube_planner_test" +
        "?authSource=admin",
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Parâmetro de conexão não autorizado"
    );
  });

  it("rejeita replica set não autorizado", () => {
    const resultado = executarMigracao({
      uri:
        "mongodb://127.0.0.1:27017/clube_planner_test" +
        "?replicaSet=outro",
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Replica set não autorizado"
    );
  });

  it("rejeita execução sem --check", () => {
    const resultado = executarMigracao({
      argumentos: [],
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Uso permitido"
    );
  });

  it("rejeita tentativa de --apply", () => {
    const resultado = executarMigracao({
      argumentos: ["--apply"],
    });

    expect(resultado.status).not.toBe(0);

    expect(resultado.stderr).toContain(
      "Uso permitido"
    );
  });
});

// ============================================================
// 3. Testes de integração
// ============================================================

describe("DM-USER-01-MIG — Diagnóstico", () => {
  it("executa o precheck no banco autorizado", () => {
    const uri = process.env.MONGODB_TEST_URI;

    if (!uri) {
      throw new Error(
        "MONGODB_TEST_URI necessária para integração."
      );
    }

    const resultado = executarMigracao({ uri });

    if (resultado.error) {
      throw resultado.error;
    }

    expect(resultado.status).toBe(0);

    expect(resultado.stdout).toContain(
      "DM-USER-01-MIG | PRECHECK"
    );

    expect(resultado.stdout).toContain(
      "Banco: clube_planner_test"
    );

    expect(resultado.stdout).toContain(
      "Índice cpf_1: OK"
    );

    expect(resultado.stdout).toContain(
      "Índice email_1: OK"
    );

    expect(resultado.stdout).toContain(
      "Índices inválidos: 0"
    );

    expect(resultado.stdout).toContain(
      "DADOS E ÍNDICES APTOS PARA REVISÃO DA MIGRAÇÃO"
    );

    expect(resultado.stdout).toContain(
      "Nenhum dado ou índice foi alterado."
    );
  });
});
