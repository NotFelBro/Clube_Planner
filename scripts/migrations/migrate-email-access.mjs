import "dotenv/config";
import mongoose from "mongoose";

// Ajusta somente o índice de CPF; preserva documentos e o índice único de e-mail.
const mode = process.argv[2];
if (!["--check", "--apply"].includes(mode) || process.argv.length !== 3) {
  throw new Error("Uso: node scripts/migrations/migrate-email-access.mjs --check|--apply");
}
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI não configurada.");
const connection = mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
try {
  await connection.asPromise();
  const users = connection.collection("users");
  const indexes = await users.indexes();
  const cpfIndex = indexes.find(index => index.key.cpf === 1 && Object.keys(index.key).length === 1);
  const ready = cpfIndex?.unique === true && cpfIndex?.partialFilterExpression?.cpf?.$type === "string";
  console.log(`Banco: ${connection.name}. Índice de CPF: ${ready ? "compatível" : "requer atualização"}.`);
  if (!ready && mode === "--apply") {
    if (cpfIndex) await users.dropIndex(cpfIndex.name);
    await users.createIndex({ cpf: 1 }, { name: "cpf_1", unique: true, partialFilterExpression: { cpf: { $type: "string" } } });
    console.log("Índice atualizado. Cadastros sem CPF permitidos.");
  } else if (!ready) {
    process.exitCode = 1;
  }
} finally {
  await connection.close();
}
