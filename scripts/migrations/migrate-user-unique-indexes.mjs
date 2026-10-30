
import mongoose from "mongoose";
import "dotenv/config";

// ============================================================
// DM-USER-01-MIG
// Auditoria dos índices globais de CPF e e-mail
//
// Modo disponível: --check
// Ambiente autorizado: clube_planner_test
// Operações: somente leitura
// ============================================================

const BANCO_PERMITIDO = "clube_planner_test";

const INDICES_ESPERADOS = [
  { nome: "cpf_1", campo: "cpf" },
  { nome: "email_1", campo: "email" },
];

// ============================================================
// 1. Validação de segurança
// ============================================================

function validarDestino(uri) {
  if (!uri) {
    throw new Error("MONGODB_TEST_URI não configurada.");
  }

  let url;

  try {
    url = new URL(uri);
  } catch {
    throw new Error("URI do MongoDB inválida.");
  }

  const destinoValido =
    url.protocol === "mongodb:" &&
    url.hostname === "127.0.0.1" &&
    url.port === "27017" &&
    url.pathname === `/${BANCO_PERMITIDO}` &&
    url.username === "" &&
    url.password === "" &&
    url.hash === "";

  if (!destinoValido) {
    throw new Error("Destino MongoDB não autorizado.");
  }

  // Permite somente parâmetros de conexão previamente aprovados.
  const parametrosPermitidos = new Set([
    "replicaSet",
    "directConnection",
    "serverSelectionTimeoutMS",
  ]);

  for (const parametro of url.searchParams.keys()) {
    if (!parametrosPermitidos.has(parametro)) {
      throw new Error(
        `Parâmetro de conexão não autorizado: ${parametro}`
      );
    }
  }

  if (
    url.searchParams.has("replicaSet") &&
    url.searchParams.get("replicaSet") !== "rs0"
  ) {
    throw new Error("Replica set não autorizado.");
  }

  if (
    url.searchParams.has("directConnection") &&
    !["true", "false"].includes(
      url.searchParams.get("directConnection")
    )
  ) {
    throw new Error("Valor de directConnection inválido.");
  }

  if (url.searchParams.has("serverSelectionTimeoutMS")) {
    const timeout = url.searchParams.get(
      "serverSelectionTimeoutMS"
    );

    if (!/^[1-9]\d*$/.test(timeout)) {
      throw new Error("Timeout de conexão inválido.");
    }
  }

  return url;
}

// ============================================================
// 2. Normalização e validação
// ============================================================

function normalizarCPF(valor) {
  if (typeof valor !== "string") return null;

  return valor.replace(/\D/g, "");
}

function validarCPF(valor) {
  if (typeof valor !== "string") return false;

  const cpf = valor.replace(/\D/g, "");

  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  function calcularDigito(tamanho) {
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    const resto = (soma * 10) % 11;

    return resto === 10 ? 0 : resto;
  }

  return (
    calcularDigito(9) === Number(cpf[9]) &&
    calcularDigito(10) === Number(cpf[10])
  );
}

function normalizarEmail(valor) {
  if (typeof valor !== "string") return null;

  return valor.trim().toLowerCase();
}

function validarEmail(valor) {
  return (
    typeof valor === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
  );
}

// ============================================================
// 3. Validação dos índices
// ============================================================

function validarIndice(indice, campo) {
  if (!indice || !indice.key) {
    return false;
  }

  const campos = Object.keys(indice.key);

  const chaveCorreta =
    campos.length === 1 &&
    campos[0] === campo &&
    indice.key[campo] === 1;

  const collationCorreta =
    indice.collation === undefined ||
    (
      indice.collation?.locale === "simple" &&
      Object.keys(indice.collation).length === 1
    );

  return (
    chaveCorreta &&
    indice.unique === true &&
    indice.partialFilterExpression === undefined &&
    indice.sparse !== true &&
    collationCorreta
  );
}

// ============================================================
// 4. Auditoria dos documentos
// ============================================================

async function auditarUsuarios(colecao) {
  const resultado = {
    documentos: 0,
    cpfInvalido: 0,
    emailInvalido: 0,
    cpfNaoNormalizado: 0,
    emailNaoNormalizado: 0,
    duplicadosCPF: 0,
    duplicadosEmail: 0,
  };

  const cpfsEncontrados = new Set();
  const emailsEncontrados = new Set();

  const cursor = colecao.find(
    {},
    {
      projection: {
        _id: 0,
        cpf: 1,
        email: 1,
      },
      batchSize: 500,
    }
  );

  try {
    for await (const usuario of cursor) {
      resultado.documentos++;

      const cpf = normalizarCPF(usuario.cpf);
      const email = normalizarEmail(usuario.email);

      // Validação do CPF
      if (!validarCPF(cpf)) {
        resultado.cpfInvalido++;
      } else {
        if (cpf !== usuario.cpf) {
          resultado.cpfNaoNormalizado++;
        }

        if (cpfsEncontrados.has(cpf)) {
          resultado.duplicadosCPF++;
        } else {
          cpfsEncontrados.add(cpf);
        }
      }

      // Validação do e-mail
      if (!validarEmail(email)) {
        resultado.emailInvalido++;
      } else {
        if (email !== usuario.email) {
          resultado.emailNaoNormalizado++;
        }

        if (emailsEncontrados.has(email)) {
          resultado.duplicadosEmail++;
        } else {
          emailsEncontrados.add(email);
        }
      }
    }
  } finally {
    await cursor.close();
  }

  return resultado;
}

// ============================================================
// 5. Execução do diagnóstico
// ============================================================

async function executar() {
  const argumentos = process.argv.slice(2);

  if (
    argumentos.length !== 1 ||
    argumentos[0] !== "--check"
  ) {
    throw new Error(
      "Uso permitido: node scripts/migrations/" +
      "migrate-user-unique-indexes.mjs --check"
    );
  }

  const uri = process.env.MONGODB_TEST_URI;

  validarDestino(uri);

  const conexao = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: false,
  });

  try {
    await conexao.asPromise();

    if (conexao.name !== BANCO_PERMITIDO) {
      throw new Error("Banco inesperado.");
    }

    const colecao = conexao.db.collection("users");
    const indices = await colecao.indexes();

    console.log("\n=== DM-USER-01-MIG | PRECHECK ===");
    console.log("Banco:", conexao.name);

    let indicesInvalidos = 0;

    for (const esperado of INDICES_ESPERADOS) {
      const indice = indices.find(
        (item) => item.name === esperado.nome
      );

      const valido = validarIndice(
        indice,
        esperado.campo
      );

      if (!valido) {
        indicesInvalidos++;
      }

      console.log(
        `Índice ${esperado.nome}:`,
        valido ? "OK" : "REVISAR"
      );
    }

    const resultado = await auditarUsuarios(colecao);

    console.log("\nDocumentos:", resultado.documentos);

    console.log(
      "CPF inválido/ausente:",
      resultado.cpfInvalido
    );

    console.log(
      "E-mail inválido/ausente:",
      resultado.emailInvalido
    );

    console.log(
      "CPF não normalizado:",
      resultado.cpfNaoNormalizado
    );

    console.log(
      "E-mail não normalizado:",
      resultado.emailNaoNormalizado
    );

    console.log(
      "CPF duplicado:",
      resultado.duplicadosCPF
    );

    console.log(
      "E-mail duplicado:",
      resultado.duplicadosEmail
    );

    // ========================================================
    // 6. Resultado consolidado
    // ========================================================

    const inconsistencias =
      indicesInvalidos +
      resultado.cpfInvalido +
      resultado.emailInvalido +
      resultado.cpfNaoNormalizado +
      resultado.emailNaoNormalizado +
      resultado.duplicadosCPF +
      resultado.duplicadosEmail;

    console.log("\nÍndices inválidos:", indicesInvalidos);

    if (inconsistencias > 0) {
      console.log(
        "\nResultado: BLOQUEADO — INCONSISTÊNCIAS ENCONTRADAS"
      );

      process.exitCode = 1;
    } else {
      console.log(
        "\nResultado: DADOS E ÍNDICES APTOS PARA REVISÃO DA MIGRAÇÃO"
      );
    }

    console.log("Nenhum dado ou índice foi alterado.");
  } finally {
    await conexao.close();
  }
}

executar().catch((erro) => {
  console.error("Falha no precheck:", erro.message);
  process.exitCode = 1;
});
