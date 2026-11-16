import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { criarHandler } = require('../src/serverless');

afterEach(() => vi.restoreAllMocks());

function servidor(opcoes = {}) {
  const app = express();
  app.use(express.json());
  app.all('/api/v1/auth/login', (req, res) => res.json({ body: req.body, query: req.query, path: req.path }));
  app.get('/api/v1/health', (req, res) => res.json({ success: true }));
  app.get('/api/v1/shop/catalog', (req, res) => res.json({ success: true }));
  app.post('/api/v1/shop/checkout', (req, res) => res.json({ success: true }));
  const inicializar = vi.fn().mockResolvedValue(undefined);
  const expirar = vi.fn().mockResolvedValue(2);
  const conciliar = vi.fn().mockResolvedValue({ consultados: 0, falhas: 0 });
  const env = { NODE_ENV: 'production', VERCEL: '1', CRON_SECRET: 's'.repeat(64) };
  const handler = criarHandler({ app, inicializar, expirar, conciliar, env, ...opcoes });
  const api = (path, method = 'get') => request(handler)[method](path).set('X-Forwarded-Proto', 'https');
  return { handler, api, inicializar, expirar, conciliar };
}

describe('entrada da API na Vercel', () => {
  it('aguarda o banco antes de atender, preservando caminho, consulta e JSON', async () => {
    let liberar;
    const pronto = new Promise(resolve => { liberar = resolve; });
    const inicializar = vi.fn(() => pronto);
    const { api } = servidor({ inicializar });
    let respondeu = false;
    const resposta = api('/api/v1/auth/login?origem=teste', 'post').send({ email: 'teste@example.com' }).then(r => { respondeu = true; return r; });
    await vi.waitFor(() => expect(inicializar).toHaveBeenCalledTimes(1));
    expect(respondeu).toBe(false);
    liberar();
    expect((await resposta).body).toEqual({ body: { email: 'teste@example.com' }, query: { origem: 'teste' }, path: '/api/v1/auth/login' });
  });

  it('recusa HTTP em produção e não inicia banco nem tarefas', async () => {
    const { handler, inicializar, expirar } = servidor();
    expect((await request(handler).get('/api/v1/health')).status).toBe(426);
    expect(inicializar).not.toHaveBeenCalled();
    expect(expirar).not.toHaveBeenCalled();
  });

  it('retorna 503 seguro se a inicialização falhar e permite nova tentativa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const inicializar = vi.fn().mockRejectedValueOnce(new Error('mongodb://usuario:senha@privado')).mockResolvedValue(undefined);
    const { api } = servidor({ inicializar });
    const resposta = await api('/api/v1/health');
    expect(resposta.status).toBe(503);
    expect(JSON.stringify(resposta.body)).not.toMatch(/senha|privado|mongodb/);
    expect(resposta.headers['cache-control']).toBe('no-store');
    expect((await api('/api/v1/health')).status).toBe(200);
  });

  it('não executa manutenção em health checks ou login', async () => {
    const { api, expirar, conciliar } = servidor();
    await api('/api/v1/health');
    await api('/api/v1/auth/login', 'post').send({});
    expect(expirar).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
  });

  it.each([
    [18, 'autenticacao_banco'], [13, 'permissao_banco'],
    [85, 'opcoes_indice'], [86, 'definicao_indice'],
    [8000, 'autenticacao_banco'],
  ])('registra apenas código e categoria do MongoDB: %s', async (codigo, diagnostico) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const erro = Object.assign(new Error('bad auth: mongodb://usuario:senha@privado dados_cliente'), { name: 'MongoServerError', code: codigo });
    const { api } = servidor({ inicializar: vi.fn().mockRejectedValue(erro) });
    const resposta = await api('/api/v1/health');
    expect(resposta.status).toBe(503);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ codigo, diagnostico, tipo: 'MongoServerError' });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/senha|privado|dados_cliente|mongodb:\/\//);
    expect(JSON.stringify(resposta.body)).not.toMatch(/codigo|diagnostico|senha/);
  });

  it('compartilha a limpeza concorrente e só repete após um minuto', async () => {
    let tempo = 0;
    let liberar;
    const expirar = vi.fn().mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; })).mockResolvedValue(0);
    const { api } = servidor({ expirar, agora: () => tempo });
    const respostas = Promise.all([api('/api/v1/shop/catalog'), api('/api/v1/shop/checkout', 'post').send({})]);
    await vi.waitFor(() => expect(expirar).toHaveBeenCalledTimes(1));
    liberar(2);
    expect((await respostas).map(r => r.status)).toEqual([200, 200]);
    await api('/api/v1/shop/catalog');
    expect(expirar).toHaveBeenCalledTimes(1);
    tempo = 60000;
    await api('/api/v1/shop/catalog');
    expect(expirar).toHaveBeenCalledTimes(2);
  });

  it('não armazena falhas de limpeza e tenta novamente no próximo acesso', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const expirar = vi.fn().mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValue(0);
    const { api } = servidor({ expirar });
    expect((await api('/api/v1/shop/catalog')).status).toBe(503);
    expect((await api('/api/v1/shop/catalog')).status).toBe(200);
    expect(expirar).toHaveBeenCalledTimes(2);
  });
});

describe('manutenção agendada', () => {
  const caminho = '/api/v1/internal/maintenance';
  it('recusa segredo ausente/incorreto antes de consultar o banco', async () => {
    const { api, inicializar, expirar, conciliar } = servidor();
    expect((await api(caminho)).status).toBe(401);
    expect((await api(caminho).set('Authorization', 'Bearer incorreto')).status).toBe(401);
    expect(inicializar).not.toHaveBeenCalled();
    expect(expirar).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('não habilita a rota quando o segredo não foi configurado', async () => {
    const { api, inicializar } = servidor({ env: { NODE_ENV: 'production', VERCEL: '1' } });
    expect((await api(caminho).set('Authorization', 'Bearer undefined')).status).toBe(401);
    expect(inicializar).not.toHaveBeenCalled();
  });

  it('executa expiração e conciliação quando autenticado, sem iniciar timers', async () => {
    const timer = vi.spyOn(globalThis, 'setInterval');
    const { api, expirar, conciliar } = servidor();
    const resposta = await api(caminho).set('Authorization', `Bearer ${'s'.repeat(64)}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body.data.expirados).toBe(2);
    expect(expirar).toHaveBeenCalledTimes(1);
    expect(conciliar).toHaveBeenCalledWith({ limite: 10 });
    expect(timer).not.toHaveBeenCalled();
  });

  it('recusa outros métodos, inclusive com segredo correto', async () => {
    const { api, inicializar } = servidor();
    const resposta = await api(caminho, 'post').set('Authorization', `Bearer ${'s'.repeat(64)}`);
    expect(resposta.status).toBe(405);
    expect(resposta.headers.allow).toBe('GET');
    expect(inicializar).not.toHaveBeenCalled();
  });
});
