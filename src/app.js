
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const app = express();

// Middlewares de segurança
app.use(helmet());

// Configuração inicial para desenvolvimento
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Leitura de JSON
app.use(express.json({ limit: "100kb" }));

// Leitura de cookies
app.use(cookieParser());

// Rota inicial de verificação
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API Clube Planner funcionando.",
  });
});

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota não encontrada.",
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error("Erro interno:", err.message);

  res.status(500).json({
    success: false,
    message: "Erro interno do servidor.",
  });
});

module.exports = app;
