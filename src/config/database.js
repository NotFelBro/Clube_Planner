
const mongoose = require("mongoose");
let conexaoPendente;

/**
 * Estabelece a conexão com o MongoDB.
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error(
      "A variável MONGODB_URI não foi definida."
    );
  }

  if (!conexaoPendente) {
    conexaoPendente = mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
    }).finally(() => { conexaoPendente = undefined; });
  }
  await conexaoPendente;
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
