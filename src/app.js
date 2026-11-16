
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");

const app = express();
const security = require("./middlewares/security");
app.set("query parser", "simple");
app.disable("etag");

app.disable("x-powered-by");

require("./config/transport").configurarTransporte(app);
app.use(helmet());
app.use("/api", security.contextoRequisicao);

app.use(
  cors({
    origin(origem, callback) {
      try {
        const permitida = new URL(process.env.FRONTEND_URL || "http://localhost:5173").origin;
        if (!origem || origem === permitida) return callback(null, true);
        return callback(Object.assign(new Error("Origem da requisição não autorizada."), { statusCode: 403 }));
      } catch (erro) { return callback(erro); }
    },
    credentials: true,
  })
);

app.use("/api", security.criarLimitadorGlobal(process.env.NODE_ENV === "test" ? 10000 : 300));
// A API só recebe JSON sem compactação; evita expansão de payload e ataques ao descompressor.
app.use(express.json({ limit: "100kb", inflate: false }));
app.use("/api", security.validarEntrada);

app.use(cookieParser());

app.get("/api/v1/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "API Clube Planner funcionando.",
  });
});

app.use("/api/v1/admin", require("./routes/adminCatalogRoutes"));
app.use("/api/v1/admin", require("./routes/adminManagementRoutes"));
app.use("/api/v1/shop", require("./routes/storeRoutes"));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth", require("./routes/accountDataRoutes"));

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Rota não encontrada.",
  });
});

app.use(security.tratarErro);

module.exports = app;
