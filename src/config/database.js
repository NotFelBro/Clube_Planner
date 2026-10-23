
const mongoose = require("mongoose");

/**
 * Estabelece a conexão com o MongoDB.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error(
      "A variável MONGODB_URI não foi definida."
    );
  }

  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log("MongoDB conectado com sucesso.");
};

/**
 * Encerra a conexão com o MongoDB.
 */
const disconnectDB = async () => {
  await mongoose.disconnect();

  console.log("Conexão com MongoDB encerrada.");
};

module.exports = {
  connectDB,
  disconnectDB,
};
