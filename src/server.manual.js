
require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");

const BANCO_MANUAL = "clube_planner_manual_test";

function obterUriManual() {
  const uri = process.env.MONGODB_MANUAL_TEST_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_MANUAL_TEST_URI não configurada."
    );
  }

  let url;

  try {
    url = new URL(uri);
  } catch {
    throw new Error(
      "MONGODB_MANUAL_TEST_URI inválida."
    );
  }

  const parametrosPermitidos = new Set([
    "replicaSet",
    "directConnection",
    "serverSelectionTimeoutMS",
  ]);

  const parametrosValidos = [
    ...url.searchParams.keys(),
  ].every((parametro) =>
    parametrosPermitidos.has(parametro)
  );

  if (
    url.protocol !== "mongodb:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "27017" ||
    url.pathname !== `/${BANCO_MANUAL}` ||
    url.username ||
    url.password ||
    url.hash ||
    !parametrosValidos
  ) {
    throw new Error(
      "Destino MongoDB não autorizado para testes manuais."
    );
  }

  return uri;
}

function obterPortaManual() {
  const valor = process.env.MANUAL_TEST_PORT ?? "3001";

  if (!/^[1-9]\d*$/.test(valor)) {
    throw new Error(
      "MANUAL_TEST_PORT inválida."
    );
  }

  const porta = Number(valor);

  if (
    !Number.isSafeInteger(porta) ||
    porta > 65535
  ) {
    throw new Error(
      "MANUAL_TEST_PORT deve estar entre 1 e 65535."
    );
  }

  return porta;
}

async function startManualServer() {
  try {
    const uri = obterUriManual();
    const porta = obterPortaManual();

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    if (
      mongoose.connection.name !== BANCO_MANUAL
    ) {
      throw new Error(
        "Banco de dados inesperado."
      );
    }

    console.log(
      `MongoDB manual conectado: ${BANCO_MANUAL}.`
    );

    const server = app.listen(
      porta,
      "127.0.0.1",
      () => {
        console.log(
          `Servidor de testes manuais iniciado na porta ${porta}.`
        );
      }
    );

    server.on("error", async (error) => {
      console.error(
        "Falha ao iniciar servidor HTTP:",
        error.message
      );

      await mongoose.disconnect();
      process.exitCode = 1;
    });

    let encerrando = false;

    const shutdown = (signal) => {
      if (encerrando) return;

      encerrando = true;

      console.log(
        `Encerrando testes manuais: ${signal}`
      );

      server.close(async (error) => {
        try {
          await mongoose.disconnect();

          if (error) {
            throw error;
          }

          process.exitCode = 0;
        } catch (erro) {
          console.error(
            "Erro ao encerrar servidor:",
            erro.message
          );

          process.exitCode = 1;
        }
      });
    };

    process.once(
      "SIGINT",
      () => shutdown("SIGINT")
    );

    process.once(
      "SIGTERM",
      () => shutdown("SIGTERM")
    );

  } catch (error) {
    console.error(
      "Falha ao iniciar testes manuais:",
      error.message
    );

    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startManualServer();
