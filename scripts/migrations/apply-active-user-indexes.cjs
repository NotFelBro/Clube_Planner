// Migração explícita local. Não remove documentos e só retira índices legados conhecidos
// depois de confirmar ambas as novas garantias de unicidade entre usuários ativos.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { garantirIndicesUsuario } = require('../../src/config/userIndexes');
async function main() {
 if (process.argv.length !== 3 || process.argv[2] !== '--apply') throw new Error('Use --apply para executar a migração local.');
 const url = new URL(process.env.MONGODB_URI);
 if (process.env.NODE_ENV === 'production' || url.protocol !== 'mongodb:' || url.hostname !== '127.0.0.1' || !['/clube_planner', '/clube_planner_test'].includes(url.pathname) || url.username || url.password) throw new Error('Somente banco local de desenvolvimento/testes autorizado.');
 const connection = mongoose.createConnection(url.toString(), { autoIndex: false, serverSelectionTimeoutMS: 5000 });
 try {
  await connection.asPromise();
  const collection = connection.collection('users');
  const before = await collection.countDocuments({});
  await garantirIndicesUsuario(collection, { migrarLegados: true });
  if (before !== await collection.countDocuments({})) throw new Error('Contagem alterada durante migração; revisar concorrência externa.');
  console.log('Índices ativos verificados. Documentos preservados:', before);
 } finally { await connection.close(); }
}
main().catch(error => { console.error('Falha na migração:', error.message); process.exitCode = 1; });
