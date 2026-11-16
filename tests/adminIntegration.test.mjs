import 'dotenv/config';
import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { randomUUID, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/product');
const Category = require('../src/models/Category');
const Order = require('../src/models/order');
const Payment = require('../src/models/payment');
const Session = require('../src/models/session');
const Cart = require('../src/models/cart');
const Event = require('../src/models/adminEvent');
const Settings = require('../src/models/storeSettings');
const orders = require('../src/services/storeOrderService');
const mp = require('../src/services/mercadoPagoService');
const catalog = require('../src/services/catalogService');
const { criarSessao } = require('../src/services/sessionService');
const origem = process.env.FRONTEND_URL || 'http://localhost:5173';
const usuarios = [], produtos = [], categorias = [];
let settingsAnterior;
let admin, cliente;
async function conta(role) {
  const u = await User.create({ nome: `Teste ${role}`, email: `${randomUUID()}@example.com`, role, ativo: true, emailVerificado: true, emailVerificadoEm: new Date(), enderecos: [{ pais: 'Brasil', cep: '06401134', logradouro: 'Rua de Teste', numero: '1', bairro: 'Centro', cidade: 'Barueri', estado: 'SP', principal: true }] });
  usuarios.push(u._id);
  const sessao = await criarSessao({ userId: u._id });
  return { user: u, token: sessao.accessToken };
}
const api = (c, method, path, body) => {
  const r = request(app)[method](path).set('Origin', origem);
  if (c) r.set('Authorization', `Bearer ${c.token}`);
  return body === undefined ? r : r.send(body);
};
async function produto() {
  const categoria = await api(admin, 'post', '/api/v1/admin/categories', { nome: 'Teste integrado', slug: 'teste-' + randomUUID(), descricao: 'Categoria de teste', ativo: true });
  expect(categoria.status).toBe(201); categorias.push(categoria.body.data.registro._id);
  const resposta = await api(admin, 'post', '/api/v1/admin/products', { nome: 'Planner integrado', slug: 'planner-' + randomUUID(), descricao: 'Criado no painel', categoriaId: categorias.at(-1), imagens: ['/products/planner-semanal.png'], ativo: true, variacoes: [{ sku: 'SKU-' + randomUUID(), atributos: { Cor: 'Rosa' }, precoCentavos: 200, estoqueDisponivel: 5, ativo: true }] });
  expect(resposta.status).toBe(201);
  const p = resposta.body.data.registro; produtos.push(p._id);
  return p;
}
async function comprar(p, quantidade = 2) {
  const resposta = await api(cliente, 'post', '/api/v1/shop/checkout', { itens: [{ id: p.variacoes[0].lojaId, quantidade }], enderecoId: String(cliente.user.enderecos[0]._id), chave: randomUUID(), totalEsperadoCentavos: p.variacoes[0].precoCentavos * quantidade + 300, freteEsperadoCentavos: 300 });
  return resposta;
}
const pagamento = p => ({ id: String(randomInt(10000000, 99999999)), external_reference: p.id, live_mode: false, currency_id: 'BRL', transaction_amount: p.totalCentavos / 100, status: 'approved', fee_details: [{ amount: 0.35 }], date_last_updated: new Date().toISOString() });
beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;
  if (process.env.NODE_ENV !== 'test' || !uri) throw new Error('Ambiente de teste obrigatório.');
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/clube_planner_test') throw new Error('Banco de teste inválido.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Product.init(), Category.init(), Order.init(), Payment.init(), Session.init(), Event.init()]);
});
beforeEach(async () => {
  vi.stubEnv('CHECKOUT_TEST_MODE', 'mercado_pago');
  settingsAnterior = await Settings.findById('loja').lean();
  admin = await conta('admin'); cliente = await conta('client');
});
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  if (mongoose.connection.name !== 'clube_planner_test') throw new Error('Limpeza bloqueada.');
  for (const model of [Payment, Order, Cart, Session]) await model.deleteMany({ userId: { $in: usuarios } });
  await Event.deleteMany({ actorId: { $in: usuarios } });
  await Product.deleteMany({ _id: { $in: produtos } });
  await Category.deleteMany({ _id: { $in: categorias } });
  await User.deleteMany({ _id: { $in: usuarios } });
  if (settingsAnterior) await Settings.collection.replaceOne({ _id: 'loja' }, settingsAnterior, { upsert: true }); else await Settings.deleteOne({ _id: 'loja' });
  usuarios.length = 0; produtos.length = 0; categorias.length = 0;
});
afterAll(async () => mongoose.disconnect());
describe('painel e loja usando os mesmos registros', () => {
  it('nega todas as consultas administrativas a visitantes e clientes', async () => {
    for (const path of ['/overview', '/reports', '/orders', '/payments', '/customers', '/settings', '/catalog']) {
      expect((await api(null, 'get', '/api/v1/admin' + path)).status).toBe(401);
      expect((await api(cliente, 'get', '/api/v1/admin' + path)).status).toBe(403);
    }
  });
  it('publica produto, preço e disponibilidade editados no painel', async () => {
    const p = await produto();
    let vitrine = await api(null, 'get', '/api/v1/shop/catalog');
    expect(vitrine.status).toBe(200);
    expect(vitrine.body.data.produtos.find(v => v.id === p.variacoes[0].lojaId)).toMatchObject({ name: p.nome, price: 2, stock: 5, image: p.imagens[0] });
    const editado = await api(admin, 'put', `/api/v1/admin/products/${p._id}`, { ...p, nome: 'Nome atualizado', variacoes: p.variacoes.map(v => ({ ...v, precoCentavos: 300 })) });
    expect(editado.status).toBe(200);
    vitrine = await api(null, 'get', '/api/v1/shop/catalog');
    expect(vitrine.body.data.produtos.find(v => v.id === p.variacoes[0].lojaId)).toMatchObject({ name: 'Nome atualizado', price: 3 });
    expect((await api(admin, 'put', `/api/v1/admin/products/${p._id}`, { ...editado.body.data.registro, ativo: false })).status).toBe(200);
    expect((await api(null, 'get', '/api/v1/shop/catalog')).body.data.produtos.some(v => v.id === p.variacoes[0].lojaId)).toBe(false);
  });
  it('mostra o pedido da loja, consome o estoque após pagar e atualiza a entrega na conta do cliente', async () => {
    const p = await produto(); const resposta = await comprar(p);
    expect(resposta.status).toBe(201); const pedido = resposta.body.data.pedido;
    expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 3, estoqueReservado: 2 });
    expect((await api(admin, 'patch', `/api/v1/admin/orders/${pedido.id}/status`, { status: 'em_preparacao' })).status).toBe(409);
    const lista = await api(admin, 'get', '/api/v1/admin/orders?ambiente=teste');
    expect(lista.body.data.pedidos.some(o => o.id === pedido.id)).toBe(true);
    await orders.aplicarPagamento(pagamento(pedido));
    expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 3, estoqueReservado: 0 });
    for (const status of ['em_preparacao', 'enviado', 'entregue']) expect((await api(admin, 'patch', `/api/v1/admin/orders/${pedido.id}/status`, { status, codigoRastreio: 'BR123456' })).status).toBe(200);
    const contaCliente = await api(cliente, 'get', `/api/v1/shop/orders/${pedido.id}`);
    expect(contaCliente.body.data.pedido).toMatchObject({ status: 'entregue', codigoRastreio: 'BR123456' });
    expect((await api(admin, 'get', `/api/v1/admin/orders/${pedido.id}`)).body.data.historico.filter(e => e.acao === 'pedido.status')).toHaveLength(3);
    expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/cancel`, {})).status).toBe(409);
  });
  it('calcula faturamento, taxas e reembolso a partir dos pagamentos e repõe estoque antes do envio', async () => {
    const base = (await api(admin, 'get', '/api/v1/admin/overview?ambiente=teste')).body.data.indicadores;
    const p = await produto(); const pedido = (await comprar(p)).body.data.pedido;
    const aprovado = pagamento(pedido); await orders.aplicarPagamento(aprovado);
    const detalhe = await api(admin, 'get', `/api/v1/admin/orders/${pedido.id}`);
    expect(detalhe.body.data.pagamentos[0]).toMatchObject({ status: 'aprovado', capturadoCentavos: 700, taxasCentavos: 35 });
    let resumo = (await api(admin, 'get', '/api/v1/admin/overview?ambiente=teste')).body.data.indicadores;
    expect(resumo.faturamentoBrutoCentavos - base.faturamentoBrutoCentavos).toBe(700);
    vi.spyOn(mp, 'encerrarPreferencia').mockResolvedValue({}); vi.spyOn(mp, 'buscarPagamentos').mockResolvedValue([aprovado]);
    vi.spyOn(mp, 'cancelarOuReembolsar').mockResolvedValue({ ...aprovado, status: 'refunded', date_last_updated: new Date(Date.now() + 1000).toISOString() });
    expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/cancel`, {})).status).toBe(200);
    resumo = (await api(admin, 'get', '/api/v1/admin/overview?ambiente=teste')).body.data.indicadores;
    expect(resumo.reembolsosCentavos - base.reembolsosCentavos).toBe(700);
    expect(resumo.receitaAposReembolsosCentavos - base.receitaAposReembolsosCentavos).toBe(0);
    expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 5, estoqueReservado: 0 });
  });
  it('impede vender mais estoque que o disponível em duas compras simultâneas', async () => {
    const p = await produto();
    const respostas = await Promise.all([comprar(p, 4), comprar(p, 4)]);
    expect(respostas.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 1, estoqueReservado: 4 });
  });
  it('integra clientes sem expor credenciais e revoga acesso ao desativar a conta', async () => {
    const lista = await api(admin, 'get', '/api/v1/admin/customers');
    expect(lista.status).toBe(200);
    expect(lista.body.data.clientes.some(c => c.id === String(cliente.user._id))).toBe(true);
    expect(JSON.stringify(lista.body)).not.toMatch(/senhaHash|recuperacaoSenha|refreshToken/);
    expect((await api(admin, 'patch', `/api/v1/admin/customers/${admin.user._id}`, { ativo: false })).status).toBe(404);
    expect((await api(admin, 'patch', `/api/v1/admin/customers/${cliente.user._id}`, { ativo: false })).status).toBe(200);
    expect((await api(cliente, 'get', '/api/v1/auth/me')).status).toBe(401);
  });
  it('publica configurações na vitrine sem expor credenciais do servidor', async () => {
    const resposta = await api(admin, 'put', '/api/v1/admin/settings', { nome: 'Loja integrada', emailAtendimento: 'contato@example.com', mensagemTopo: 'Novidades da loja', estoqueCritico: 3 });
    expect(resposta.status).toBe(200);
    expect((await api(null, 'get', '/api/v1/shop/catalog')).body.data.loja).toMatchObject({ nome: 'Loja integrada', mensagemTopo: 'Novidades da loja', emailAtendimento: 'contato@example.com' });
    const configuracao = await api(admin, 'get', '/api/v1/admin/settings');
    expect(JSON.stringify(configuracao.body)).not.toMatch(/MP_ACCESS_TOKEN|SMTP_PASS|JWT_ACCESS_SECRET/);
  });
  it('rejeita filtros e períodos inválidos sem erro interno', async () => {
    for (const query of ['pagina=-1', 'ambiente=invalido', 'de=2026-02-31&ate=2026-03-01', 'de=2020-01-01&ate=2026-01-01']) expect((await api(admin, 'get', '/api/v1/admin/orders?' + query)).status).toBe(400);
  });
});

it('retoma um pedido já criado mesmo se o produto for desativado depois', async () => {
  const p = await produto();
  const body = { itens: [{ id: p.variacoes[0].lojaId, quantidade: 1 }], enderecoId: String(cliente.user.enderecos[0]._id), chave: randomUUID(), totalEsperadoCentavos: 500, freteEsperadoCentavos: 300 };
  const primeira = await api(cliente, 'post', '/api/v1/shop/checkout', body);
  expect(primeira.status).toBe(201);
  await Product.updateOne({ _id: p._id }, { $set: { ativo: false } });
  const repetida = await api(cliente, 'post', '/api/v1/shop/checkout', body);
  expect(repetida.status).toBe(201); expect(repetida.body.data.pedido.id).toBe(primeira.body.data.pedido.id);
  expect(await Order.countDocuments({ userId: cliente.user._id })).toBe(1);
});
it('libera estoque expirado uma vez e reembolsa aprovação tardia sem vender sem reserva', async () => {
  const p = await produto(), pedido = (await comprar(p)).body.data.pedido;
  await Order.updateOne({ _id: pedido.id }, { $set: { 'reserva.expiresAt': new Date(0) } });
  const { expirarReserva } = require('../src/services/reservationExpiryService');
  expect(await expirarReserva(pedido.id)).toBe(true);
  expect(await expirarReserva(pedido.id)).toBe(false);
  const aprovado = pagamento(pedido);
  vi.spyOn(mp, 'cancelarOuReembolsar').mockResolvedValue({ ...aprovado, status: 'refunded', date_last_updated: new Date(Date.now() + 1000).toISOString() });
  await orders.aplicarPagamento(aprovado);
  expect((await Order.findById(pedido.id)).status).toBe('cancelado');
  expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 5, estoqueReservado: 0 });
});
it('não repõe automaticamente estoque de um produto já enviado ao reembolsar', async () => {
  const p = await produto(), pedido = (await comprar(p)).body.data.pedido, aprovado = pagamento(pedido);
  await orders.aplicarPagamento(aprovado);
  for (const status of ['em_preparacao', 'enviado']) await api(admin, 'patch', `/api/v1/admin/orders/${pedido.id}/status`, { status });
  vi.spyOn(mp, 'encerrarPreferencia').mockResolvedValue({}); vi.spyOn(mp, 'buscarPagamentos').mockResolvedValue([aprovado]);
  vi.spyOn(mp, 'cancelarOuReembolsar').mockResolvedValue({ ...aprovado, status: 'refunded', date_last_updated: new Date(Date.now() + 1000).toISOString() });
  expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/cancel`, {})).status).toBe(200);
  expect((await Product.findById(p._id)).variacoes[0].estoqueDisponivel).toBe(3);
  expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/stock-return`, {})).status).toBe(200);
  expect((await Product.findById(p._id)).variacoes[0].estoqueDisponivel).toBe(5);
  expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/stock-return`, {})).status).toBe(409);
});
it('preserva estoques editados ao executar novamente a importação do catálogo', async () => {
  await catalog.inicializarCatalogo({ estoqueInicial: 100 });
  const sample = await Product.findOne({ 'variacoes.lojaId': 1 });
  await Product.updateOne({ _id: sample._id }, { $set: { 'variacoes.0.estoqueDisponivel': 77 } });
  try {
    await catalog.inicializarCatalogo({ estoqueInicial: 100 });
    expect((await Product.findById(sample._id)).variacoes[0].estoqueDisponivel).toBe(77);
    expect(await Product.countDocuments({ 'variacoes.lojaId': 1 })).toBe(1);
  } finally { await Product.updateOne({ _id: sample._id }, { $set: { 'variacoes.0.estoqueDisponivel': 100 } }); }
});

it('revalida o preço no banco se o administrador editar durante a cotação de frete', async () => {
  const p = await produto();
  const shipping = require('../src/services/shippingService');
  const cotar = shipping.cotarFrete;
  vi.spyOn(shipping, 'cotarFrete').mockImplementation(async cep => {
    const frete = await cotar(cep);
    await Product.updateOne({ _id: p._id }, { $set: { 'variacoes.0.precoCentavos': 300 } });
    return frete;
  });
  expect((await comprar(p)).status).toBe(409);
  expect(await Order.countDocuments({ userId: cliente.user._id })).toBe(0);
  expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({ estoqueDisponivel: 5, estoqueReservado: 0 });
});

describe('falhas do painel sem corromper os dados da loja', () => {
  it('desfaz a edição de produto se a auditoria falhar e mantém a vitrine acessível', async () => {
    const p = await produto();
    const auditoria = vi.spyOn(Event, 'create').mockRejectedValue(new Error('falha interna simulada'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resposta = await api(admin, 'put', `/api/v1/admin/products/${p._id}`, { ...p, nome: 'Não deve salvar', variacoes: p.variacoes.map(v => ({ ...v, precoCentavos: 300 })) });
    expect(resposta.status).toBe(500);
    expect((await Product.findById(p._id)).nome).toBe(p.nome);
    const vitrine = await api(null, 'get', '/api/v1/shop/catalog');
    expect(vitrine.status).toBe(200);
    expect(vitrine.body.data.produtos.find(v => v.id === p.variacoes[0].lojaId).price).toBe(2);
    auditoria.mockRestore();
    expect((await comprar(p)).status).toBe(201);
  });
  it('não avança entrega se a gravação do histórico falhar', async () => {
    const p = await produto(), pedido = (await comprar(p)).body.data.pedido;
    await orders.aplicarPagamento(pagamento(pedido));
    vi.spyOn(Event, 'create').mockRejectedValue(new Error('falha de auditoria'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await api(admin, 'patch', `/api/v1/admin/orders/${pedido.id}/status`, { status: 'em_preparacao' })).status).toBe(500);
    expect((await Order.findById(pedido.id)).status).toBe('pago');
    expect((await api(cliente, 'get', `/api/v1/shop/orders/${pedido.id}`)).body.data.pedido.status).toBe('pago');
  });
  it('recusa rastreio de tipo inválido e campos não autorizados com erro de validação', async () => {
    const p = await produto(), pedido = (await comprar(p)).body.data.pedido;
    await orders.aplicarPagamento(pagamento(pedido));
    for (const codigoRastreio of [null, 0, false, {}]) expect((await api(admin, 'patch', `/api/v1/admin/orders/${pedido.id}/status`, { status: 'em_preparacao', codigoRastreio })).status).toBe(400);
    expect((await api(admin, 'patch', `/api/v1/admin/customers/${cliente.user._id}`, { ativo: true, role: 'admin' })).status).toBe(400);
    expect((await User.findById(cliente.user._id)).role).toBe('client');
    expect((await Order.findById(pedido.id)).status).toBe('pago');
  });
  it('transforma consulta administrativa vencida em 503 sem afetar a consulta da loja', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const agregado = vi.spyOn(Order, 'aggregate').mockImplementationOnce(() => { throw Object.assign(new Error('consulta interna secreta'), { code: 50 }); });
    const resposta = await api(admin, 'get', '/api/v1/admin/overview');
    expect(resposta.status).toBe(503); expect(resposta.body.requestId).toBeTruthy();
    expect(JSON.stringify(resposta.body)).not.toContain('secreta'); agregado.mockRestore();
    expect((await api(null, 'get', '/api/v1/shop/catalog')).status).toBe(200);
    expect((await api(cliente, 'get', '/api/v1/auth/me')).status).toBe(200);
  });
  it('não sobrescreve configurações usando uma versão antiga', async () => {
    const inicial = (await api(admin, 'get', '/api/v1/admin/settings')).body.data.loja;
    const primeira = await api(admin, 'put', '/api/v1/admin/settings', { ...inicial, mensagemTopo: 'Primeira alteração' });
    expect(primeira.status).toBe(200);
    expect((await api(admin, 'put', '/api/v1/admin/settings', { ...inicial, mensagemTopo: 'Alteração antiga' })).status).toBe(409);
    expect((await api(null, 'get', '/api/v1/shop/catalog')).body.data.loja.mensagemTopo).toBe('Primeira alteração');
    const atual = primeira.body.data.loja;
    expect((await api(admin, 'put', '/api/v1/admin/settings', { ...atual, mensagemTopo: 'Versão nova' })).status).toBe(200);
  });
  it('desfaz configurações se o registro de auditoria falhar', async () => {
    const inicial = (await api(admin, 'get', '/api/v1/admin/settings')).body.data.loja;
    vi.spyOn(Event, 'create').mockRejectedValue(new Error('auditoria indisponível'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await api(admin, 'put', '/api/v1/admin/settings', { ...inicial, nome: 'Não deve publicar' })).status).toBe(500);
    expect((await api(null, 'get', '/api/v1/shop/catalog')).body.data.loja.nome).toBe(inicial.nome);
  });
  it('não cancela nem devolve estoque de pedido pago quando o provedor está indisponível', async () => {
    const p = await produto(), pedido = (await comprar(p)).body.data.pedido;
    await orders.aplicarPagamento(pagamento(pedido));
    vi.spyOn(mp, 'encerrarPreferencia').mockResolvedValue({});
    vi.spyOn(mp, 'buscarPagamentos').mockRejectedValue(new (require('../src/services/authService').AuthError)('Provedor indisponível.', 503));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await api(admin, 'post', `/api/v1/admin/orders/${pedido.id}/cancel`, {})).status).toBe(503);
    const salvo = await Order.findById(pedido.id);
    expect(salvo.status).toBe('pago'); expect(salvo.cancelamentoSolicitadoEm).toBeTruthy();
    expect((await Product.findById(p._id)).variacoes[0].estoqueDisponivel).toBe(3);
    expect((await api(null, 'get', '/api/v1/shop/catalog')).status).toBe(200);
  });
});

it('concilia pagamento com frete separado e atualiza perfil, pedidos pagos e faturamento uma única vez',async()=>{
 const p=await produto(),pedido=(await comprar(p)).body.data.pedido;
 await Order.updateOne({_id:pedido.id},{$set:{preferenceId:'preferencia-teste'}});
 const approved={...pagamento(pedido), transaction_amount:4, shipping_amount:3,date_approved:new Date().toISOString()};
 vi.spyOn(mp,'buscarPagamentos').mockResolvedValue([approved]);
 const base=(await api(admin,'get','/api/v1/admin/overview?ambiente=teste')).body.data.indicadores;
 const sync=await api(cliente,'post','/api/v1/shop/orders/sync',{});
 expect(sync.status).toBe(200);expect(sync.body.data).toMatchObject({consultados:1,falhas:0});
 const perfil=await api(cliente,'get','/api/v1/shop/orders');expect(perfil.body.data.pedidos.find(o=>o.id===pedido.id)).toMatchObject({status:'pago',pagamentoStatus:'aprovado'});
 expect((await api(admin,'get','/api/v1/admin/orders?status=pago')).body.data.pedidos.some(o=>o.id===pedido.id)).toBe(true);
 const depois=(await api(admin,'get','/api/v1/admin/overview?ambiente=teste')).body.data.indicadores;
 expect(depois.faturamentoBrutoCentavos-base.faturamentoBrutoCentavos).toBe(700);
 await orders.sincronizar(cliente.user.id,pedido.id);await orders.sincronizar(cliente.user.id,pedido.id);
 expect(await Payment.countDocuments({orderId:pedido.id})).toBe(1);
 expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({estoqueDisponivel:3,estoqueReservado:0});
});
it('recupera aprovação dentro do prazo consultada após expirar a reserva sem reembolsar indevidamente',async()=>{
 const p=await produto(),pedido=(await comprar(p)).body.data.pedido;
 const aprovado={...pagamento(pedido),date_approved:new Date().toISOString()};
 const original=await Order.findById(pedido.id);
 await require('../src/services/reservationExpiryService').expirarReserva(pedido.id,new Date(original.reserva.expiresAt.getTime()+1000));
 const refund=vi.spyOn(mp,'cancelarOuReembolsar');
 await orders.aplicarPagamento(aprovado);
 expect((await Order.findById(pedido.id))).toMatchObject({status:'pago',pagamentoStatus:'aprovado',cancelamentoSolicitadoEm:null,cancelamentoOrigem:null,estoqueStatus:'consumido'});
 expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({estoqueDisponivel:3,estoqueReservado:0});
 await orders.aplicarPagamento(aprovado);
 expect((await Product.findById(p._id)).variacoes[0].estoqueDisponivel).toBe(3);expect(refund).not.toHaveBeenCalled();
});
it('não aceita live_mode=true fornecido diretamente sem validação autenticada no adaptador',async()=>{
 const p=await produto(),pedido=(await comprar(p)).body.data.pedido;
 await expect(orders.aplicarPagamento({...pagamento(pedido),live_mode:true,metadata:{ambiente:'teste',order_id:pedido.id}})).rejects.toThrow('não correspondem');
 expect((await Order.findById(pedido.id)).status).toBe('aguardando_pagamento');
});
it('conciliação de um pedido com falha não impede aprovação dos outros nem altera o pedido com falha',async()=>{
 const p=await produto(),a=(await comprar(p,1)).body.data.pedido,b=(await comprar(p,1)).body.data.pedido;
 await Order.updateMany({_id:{$in:[a.id,b.id]}},{$set:{preferenceId:'preferencia-teste'}});
 vi.spyOn(console,'error').mockImplementation(()=>{});
 vi.spyOn(mp,'buscarPagamentos').mockImplementation(async id=>{if(id===a.id)throw Error('provedor indisponível');return[pagamento(b)];});
 const resultado=await require('../src/services/paymentReconciliationService').conciliarPedidos({userId:cliente.user.id});
 expect(resultado).toMatchObject({consultados:2,falhas:1});
 expect((await Order.findById(a.id)).status).toBe('aguardando_pagamento');expect((await Order.findById(b.id)).status).toBe('pago');
});
it('notificações simultâneas não duplicam pagamento nem consumo de estoque',async()=>{
 const p=await produto(),pedido=(await comprar(p)).body.data.pedido,approved=pagamento(pedido);
 await Promise.all([orders.aplicarPagamento(approved),orders.aplicarPagamento(approved)]);
 expect(await Payment.countDocuments({orderId:pedido.id})).toBe(1);
 expect((await Product.findById(p._id)).variacoes[0]).toMatchObject({estoqueDisponivel:3,estoqueReservado:0});
});
