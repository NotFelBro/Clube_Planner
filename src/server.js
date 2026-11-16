
require("dotenv").config();

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/database");

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    require("./config/security").validarConfiguracaoSegura();
    const User = require("./models/User");
    // A verificação explícita aceita nomes equivalentes e recusa índices inseguros.
    User.schema.set("autoIndex", false);
    await connectDB();
    await User.init();
    await require("./config/userIndexes").garantirIndicesUsuario(User.collection);

    await Promise.all([require("./models/product").init(), require("./models/Category").init(), require("./models/catalogCounter").init(), require("./models/adminEvent").init(), require("./models/storeSettings").init(), require("./models/order").init()]);
    await require("./services/catalogService").inicializarCatalogo({ estoqueInicial: 100 });

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
