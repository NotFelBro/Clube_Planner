
require("dotenv").config();

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/database");

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `Servidor Clube Planner iniciado na porta ${PORT}.`
      );
    });

    const shutdown = async (signal) => {
      console.log(`Encerrando aplicação: ${signal}`);

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
