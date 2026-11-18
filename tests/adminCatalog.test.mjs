import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
const require = createRequire(import.meta.url);
const auth = require('../src/middlewares/authMiddleware');
const Product = require('../src/models/product');
const Category = require('../src/models/Category');
// Exercise real authorization and route validation with a controlled authenticated identity.
vi.spyOn(auth, 'autenticar').mockImplementation((req, res, next) => {
  if (!req.headers['x-role']) return res.status(401).end();
  req.auth = { role: req.headers['x-role'] }; next();
});
const app = express();
app.use(express.json());
app.use('/admin', require('../src/routes/adminCatalogRoutes'));
app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
const categoryId = '507f1f77bcf86cd799439011';
const body = () => ({ nome: 'Planner', slug: 'planner', descricao: 'Planner anual', ativo: true, categoriaId: categoryId, imagens: ['https://example.com/image.jpg'], variacoes: [{ sku: 'PLAN-A5', atributos: { Cor: 'Rosa' }, precoCentavos: 12590, estoqueDisponivel: 5, ativo: true }] });
const post = data => request(app).post('/admin/products').set('x-role', 'admin').set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173').send(data);
afterEach(() => { vi.restoreAllMocks(); });
describe('administrative catalog', () => {
  it('rejects unauthenticated and client access', async () => {
    expect((await request(app).get('/admin/catalog')).status).toBe(401);
    expect((await request(app).get('/admin/catalog').set('x-role', 'client')).status).toBe(403);
  });
  it('requires the approved origin on writes', async () => {
    expect((await request(app).post('/admin/products').set('x-role', 'admin').send(body())).status).toBe(403);
  });
  it('returns the catalog when an imported category was inserted into products', async () => {
    const categoria = { _id: categoryId, nome: 'Cadernos' };
    const produto = body();
    delete produto.imagens;
    vi.spyOn(Product, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(), maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([categoria, produto]),
    });
    vi.spyOn(Category, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(), maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([categoria]),
    });
    const resposta = await request(app).get('/admin/catalog').set('x-role', 'admin');
    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toEqual({
      produtos: [{ ...produto, imagens: [] }], categorias: [categoria], registrosInvalidos: 1,
    });
  });
  it('creates a product without accepting client supplied reserved stock', async () => {
    vi.spyOn(Category, 'exists').mockResolvedValue({ _id: categoryId });
    const create = vi.spyOn(Product, 'create').mockImplementation(async data => data);
    const data = body(); data.variacoes[0].estoqueReservado = 999;
    const res = await post(data);
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0].variacoes[0].estoqueReservado).toBe(0);
  });
  it.each([
    ['fractional price', data => { data.variacoes[0].precoCentavos = 1.5; }],
    ['negative stock', data => { data.variacoes[0].estoqueDisponivel = -1; }],
    ['script image URL', data => { data.imagens = ['javascript:alert(1)']; }],
    ['no variations', data => { data.variacoes = []; }],
    ['invalid attributes', data => { data.variacoes[0].atributos = { '$cor': 'rosa' }; }],
  ])('rejects %s', async (_, mutate) => {
    vi.spyOn(Category, 'exists').mockResolvedValue({ _id: categoryId });
    const create = vi.spyOn(Product, 'create');
    const data = body(); mutate(data);
    expect((await post(data)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects duplicate SKUs in the model', async () => {
    const data = body(); data.variacoes.push({ ...data.variacoes[0], sku: 'plan-a5' });
    await expect(new Product(data).validate()).rejects.toThrow('SKUs');
  });
  it('returns a conflict for existing slugs or SKUs', async () => {
    vi.spyOn(Category, 'exists').mockResolvedValue({ _id: categoryId });
    vi.spyOn(Product, 'create').mockRejectedValue({ code: 11000 });
    expect((await post(body())).status).toBe(409);
  });
  it('preserves variation identity and reserved stock when editing', async () => {
    const previous = new Product(body());
    previous.updatedAt = new Date('2026-01-02');
    previous.variacoes[0].estoqueReservado = 3;
    vi.spyOn(Category, 'exists').mockResolvedValue({ _id: categoryId });
    vi.spyOn(Product, 'findById').mockResolvedValue(previous);
    const update = vi.spyOn(Product, 'findOneAndUpdate').mockResolvedValue(previous);
    const data = body();
    data.updatedAt = previous.updatedAt.toISOString();
    data.variacoes[0]._id = String(previous.variacoes[0]._id);
    data.variacoes[0].estoqueReservado = 0;
    const res = await request(app).put(`/admin/products/${categoryId}`).set('x-role', 'admin').set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173').send(data);
    expect(res.status).toBe(200);
    expect(update.mock.calls[0][1].$set.variacoes[0].estoqueReservado).toBe(3);
    expect(String(update.mock.calls[0][1].$set.variacoes[0]._id)).toBe(data.variacoes[0]._id);
  });
  it('prevents removing a variation with reservations', async () => {
    const previous = new Product(body());
    previous.updatedAt = new Date('2026-01-02');
    previous.variacoes[0].estoqueReservado = 3;
    vi.spyOn(Category, 'exists').mockResolvedValue({ _id: categoryId });
    vi.spyOn(Product, 'findById').mockResolvedValue(previous);
    const res = await request(app).put(`/admin/products/${categoryId}`).set('x-role', 'admin').set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173').send({ ...body(), updatedAt: previous.updatedAt.toISOString() });
    expect(res.status).toBe(400);
  });
  it('rejects stale edits', async () => {
    vi.spyOn(Product, 'findById').mockResolvedValue({ updatedAt: new Date('2026-01-02') });
    const res = await request(app).put(`/admin/products/${categoryId}`).set('x-role', 'admin').set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173').send({ ...body(), updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(res.status).toBe(409);
  });
});
