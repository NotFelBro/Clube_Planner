import { describe, expect, it, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const app = require('../src/app');
const security = require('../src/middlewares/security');
const config = require('../src/config/security');
const User = require('../src/models/User');
const origem = process.env.FRONTEND_URL || 'http://localhost:5173';
afterEach(() => vi.restoreAllMocks());
const post = body => request(app).post('/api/v1/auth/login').set('Origin', origem).send(body);
describe('entradas e respostas defensivas', () => {
  it.each([
    { email: { $ne: null }, senha: 'a' },
    JSON.parse('{"email":"a@example.com","__proto__":{"admin":true}}'),
    { constructor: { prototype: { role: 'admin' } } },
    { email: 'a@example.com', 'usuario.role': 'admin' },
    [],
  ])('recusa payload hostil antes de consultar o banco: %j', async body => {
    const consulta = vi.spyOn(User, 'findOne');
    const resposta = await post(body);
    expect(resposta.status).toBe(400);
    expect(consulta).not.toHaveBeenCalled();
    expect({}.admin).toBeUndefined();
  });
  it('recusa JSON inválido, tamanho excessivo, conteúdo de texto e compactação', async () => {
    const enviar = (body, type = 'application/json') => request(app).post('/api/v1/auth/login').set('Origin', origem).set('Content-Type', type).send(body);
    expect((await enviar('{')).status).toBe(400);
    expect((await enviar(JSON.stringify({ senha: 'x'.repeat(103000) }))).status).toBe(413);
    expect((await enviar('teste', 'text/plain')).status).toBe(415);
    expect((await request(app).post('/api/v1/auth/login').set('Origin', origem).set('Content-Type', 'application/json').set('Content-Encoding', 'gzip').send('{}')).status).toBe(415);
  });
  it('recusa profundidade excessiva e origens externas', async () => {
    let body = { valor: 'x' }; for (let i = 0; i < 15; i++) body = { dados: body };
    expect((await post(body)).status).toBe(400);
    expect((await request(app).get('/api/v1/health').set('Origin', 'https://evil.example')).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/login').send({})).status).toBe(403);
  });
  it('não expõe dados em cache nem assinatura do servidor', async () => {
    const resposta = await request(app).get('/api/v1/health');
    expect(resposta.headers['cache-control']).toBe('no-store');
    expect(resposta.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(resposta.headers['x-powered-by']).toBeUndefined();
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
  });
  it('bloqueia tentativa de entrar em rotas privadas com identidade enviada pelo cliente', async () => {
    for (const rota of ['/api/v1/admin/catalog', '/api/v1/shop/orders', '/api/v1/auth/addresses']) {
      const resposta = await request(app).get(rota).set('x-role', 'admin').set('x-user-id', '000000000000000000000001');
      expect(resposta.status).toBe(401);
    }
  });
});
describe('tratamento de falhas sem vazamento', () => {
  const erros = [
    [Object.assign(new Error('mongodb://segredo/senha'), { name: 'MongoNetworkError' }), 503],
    [Object.assign(new Error('senha em stack'), { name: 'CastError' }), 400],
    [Object.assign(new Error('email duplicado'), { code: 11000 }), 409],
    [new Error('senha=secreto'), 500],
  ];
  it.each(erros)('converte erro em resposta segura: %s', async (erro, status) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const teste = express(); teste.use(security.contextoRequisicao); teste.get('/', () => { throw erro; }); teste.use(security.tratarErro);
    const resposta = await request(teste).get('/');
    expect(resposta.status).toBe(status);
    expect(resposta.body.success).toBe(false);
    expect(JSON.stringify(resposta.body)).not.toMatch(/segredo|secreto|stack|mongodb/);
    expect(resposta.body.requestId).toBeTruthy();
  });
});
describe('limites de abuso', () => {
  it('limita tráfego por IP com JSON e Retry-After', async () => {
    const teste = express(); teste.use(security.criarLimitadorGlobal(2)); teste.get('/', (req, res) => res.json({ success: true }));
    await request(teste).get('/'); await request(teste).get('/');
    const resposta = await request(teste).get('/');
    expect(resposta.status).toBe(429); expect(resposta.body.success).toBe(false); expect(resposta.headers['retry-after']).toBeTruthy();
  });
  it('normaliza conta e limita falhas sem limitar logins bem-sucedidos', async () => {
    const teste = express(); teste.use(express.json()); teste.use(security.criarLimitadorLogin(2));
    teste.post('/', (req, res) => res.status(req.body.ok ? 200 : 401).json({}));
    for (let i = 0; i < 3; i++) expect((await request(teste).post('/').send({ email: 'teste@example.com', ok: true })).status).toBe(200);
    await request(teste).post('/').send({ email: 'teste@example.com' });
    await request(teste).post('/').send({ email: 'TESTE@EXAMPLE.COM' });
    expect((await request(teste).post('/').send({ email: ' teste@example.com ' })).status).toBe(429);
  });
});
describe('configuração de produção', () => {
  it('exige HTTPS e segredos antes de iniciar', () => {
    expect(() => config.validarConfiguracaoSegura({ NODE_ENV: 'production' })).toThrow('HTTPS');
    const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://loja.example', MONGODB_URI: 'mongodb://local/base', JWT_ACCESS_SECRET: 'a'.repeat(64), EMAIL_CODE_SECRET: 'b'.repeat(32) };
    expect(() => config.validarConfiguracaoSegura(env)).not.toThrow();
    expect(() => config.validarConfiguracaoSegura({ ...env, JWT_ACCESS_SECRET: 'fraco' })).toThrow('JWT');
    expect(() => config.validarConfiguracaoSegura({ ...env, FRONTEND_URL: 'http://loja.example' })).toThrow('HTTPS');
  });
});
