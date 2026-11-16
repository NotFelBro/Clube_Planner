import 'dotenv/config';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export default async function setup() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) return;
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || url.hostname !== '127.0.0.1' || url.pathname !== '/clube_planner_test' || url.username || url.password) throw new Error('Preparação de índices restrita ao banco de testes local.');
  const conn = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  try { await require('../src/config/userIndexes').garantirIndicesUsuario(conn.collection('users'), { migrarLegados: true }); }
  finally { await conn.close(); }
}
