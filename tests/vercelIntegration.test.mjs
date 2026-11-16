import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let handler;

beforeAll(async () => {
  const uri = new URL(process.env.MONGODB_TEST_URI);
  if (uri.hostname !== '127.0.0.1' || uri.pathname !== '/clube_planner_test' || uri.username || uri.password) throw new Error('Banco isolado obrigatório.');
  vi.stubEnv('MONGODB_URI', uri.href);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('FRONTEND_URL', 'https://clube-planner.vercel.app');
  vi.stubEnv('JWT_ACCESS_SECRET', 'j'.repeat(64));
  vi.stubEnv('EMAIL_CODE_SECRET', 'e'.repeat(64));
  vi.stubEnv('CRON_SECRET', 'c'.repeat(64));
  // Mesma entrada que a Vercel importa. Nenhum timer ou listener é iniciado.
  handler = require('../api/index');
});
afterAll(async () => { await mongoose.disconnect(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('integração real da entrada Vercel', () => {
  it('inicializa a conexão e índices uma vez para chamadas concorrentes', async () => {
    const conectar = vi.spyOn(mongoose, 'connect');
    const respostas = await Promise.all(Array.from({ length: 3 }, () => request(handler).get('/api/v1/health').set('X-Forwarded-Proto', 'https')));
    expect(respostas.map(r => r.status)).toEqual([200, 200, 200]);
    expect(conectar).toHaveBeenCalledTimes(1);
    expect(mongoose.connection.name).toBe('clube_planner_test');
    const Order = require('../src/models/order');
    expect((await Order.collection.indexes()).some(i => i.unique && i.key.userId === 1 && i.key.checkoutIdempotencyKey === 1)).toBe(true);
  });

  it('reutiliza a conexão, mantém proteção de rotas e recusa origem externa', async () => {
    const conectar = vi.spyOn(mongoose, 'connect'); conectar.mockClear();
    const privado = await request(handler).get('/api/v1/shop/orders').set('X-Forwarded-Proto', 'https');
    expect(privado.status).toBe(401);
    expect(privado.headers['cache-control']).toBe('no-store');
    const externo = await request(handler).post('/api/v1/auth/login').set('X-Forwarded-Proto', 'https').set('Origin', 'https://evil.example').send({});
    expect(externo.status).toBe(403);
    expect(conectar).not.toHaveBeenCalled();
  });

  it('reconecta depois de uma desconexão sem reiniciar o processo', async () => {
    await mongoose.disconnect();
    const conectar = vi.spyOn(mongoose, 'connect'); conectar.mockClear();
    const resposta = await request(handler).get('/api/v1/health').set('X-Forwarded-Proto', 'https');
    expect(resposta.status).toBe(200);
    expect(conectar).toHaveBeenCalledTimes(1);
    expect(mongoose.connection.name).toBe('clube_planner_test');
  });

  it('mantém os pagamentos de demonstração bloqueados em produção', async () => {
    expect(require('../src/services/sampleCatalogService').configuracao().habilitado).toBe(false);
  });
});
