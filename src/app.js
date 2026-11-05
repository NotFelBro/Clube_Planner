
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));

app.use(cookieParser());

app.get("/api/v1/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "API Clube Planner funcionando.",
  });
});

app.use("/api/v1/auth", authRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Rota não encontrada.",
  });
});

app.use((err, req, res, next) => {
  if (err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      success: false,
      message: "JSON inválido.",
    });
  }

  console.error("Erro interno:", err.message);

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor.",
  });
});

module.exports = app;
