
require("dotenv").config();

const app = require("./app");
const { disconnectDB } = require("./config/database");
const { inicializarAplicacao } = require("./config/bootstrap");

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await inicializarAplicacao();

    const server = app.listen(PORT, process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0", () => {
      console.log(
        `Servidor Clube Planner iniciado na porta ${PORT}.`
      );
    });

    const pararConciliacao = require("./services/paymentReconciliationService").iniciarConciliacaoPagamentos();
    const pararExpiracao = require("./services/reservationExpiryService").iniciarExpiracaoReservas();

    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    server.keepAliveTimeout = 5000;
    server.maxRequestsPerSocket = 100;

    const shutdown = async (signal) => {
      console.log(`Encerrando aplicação: ${signal}`);
      pararExpiracao();
      pararConciliacao();

      server.close(async () => {
        try {
          await disconnectDB();
          process.exit(0);
        } catch (error) {
          console.error("Erro ao desconectar:", error.message);
          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    console.error(
      "Falha ao iniciar o servidor:",
      error.message
    );

    process.exit(1);
  }
};

startServer();
