import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";

import "dotenv/config";
import mongoose from "mongoose";
import request from "supertest";

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";


const require = createRequire(import.meta.url);

const app = require("../src/app.js");
const User = require("../src/models/User.js");
const Session = require("../src/models/session.js");

const emailService = require(
  "../src/services/emailService.js"
);

const enviarEmailOriginal =
  emailService.enviarLinkVerificacao;


const Order = require("../src/models/order");
const Payment = require("../src/models/payment");
const Cart = require("../src/models/cart");
const Review = require("../src/models/review");
const mp = require("../src/services/mercadoPagoService");
const shipping = require("../src/services/shippingService");
const shippingRules = require("../shared/shippingRules.json");
const orders = require("../src/services/storeOrderService");
const SHOP = "/api/v1/shop";
const BASE = "/api/v1/auth";

const ORIGEM =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";


const usuariosCriados = new Set();

function obterUriDeTeste() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Os testes exigem NODE_ENV=test."
    );
  }

  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_TEST_URI não configurada."
    );
  }

  let url;

  try {
    url = new URL(uri);
  } catch {
    throw new Error(
      "MONGODB_TEST_URI inválida."
    );
  }

  const banco = decodeURIComponent(
    url.pathname.replace(/^\//, "")
  );

  const parametrosPermitidos = new Set([
    "replicaSet",
    "directConnection",
    "serverSelectionTimeoutMS",
  ]);

  const parametrosValidos = [
    ...url.searchParams.keys(),
  ].every((parametro) =>
    parametrosPermitidos.has(parametro)
  );

  if (
    url.protocol !== "mongodb:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "27017" ||
    banco !== "clube_planner_test" ||
    url.username ||
    url.password ||
    url.hash ||
    !parametrosValidos
  ) {
    throw new Error(
      "Destino MongoDB não autorizado."
    );
  }

  if (
    url.searchParams.get("replicaSet") !== "rs0"
  ) {
    throw new Error(
      "Replica set de testes inesperado."
    );
  }

  return uri;
}

function obterCookie(resposta) {
  const cookies =
    resposta.headers["set-cookie"] || [];

  const cookie = cookies.find((item) =>
    item.startsWith("refreshToken=")
  );

  if (!cookie) {
    throw new Error(
      "Cookie refreshToken não encontrado."
    );
  }

  return cookie.split(";")[0];
}

async function criarUsuario() {
  const dados = {
    nome: "Cliente Sessão Teste",
    senha: "senha-teste",
    aceitouPrivacidade: true,
    email:
      `session-${randomUUID()}@example.com`,
  };

  const resposta = await request(app)
    .post(`${BASE}/register`)
    .set("Origin", ORIGEM)
    .send(dados);

  if (resposta.status === 201) {
    usuariosCriados.add(
      resposta.body.data.usuario.id
    );
  } else {
    const usuario = await User.findOne({
      email: dados.email,
    }).select("_id");

    if (usuario) {
      usuariosCriados.add(
        String(usuario._id)
      );
    }
  }

  expect(resposta.status).toBe(201);

  // Simula uma confirmação de e-mail concluída,
  // exclusivamente no banco de testes.
  const atualizacao = await User.updateOne(
    {
      _id: resposta.body.data.usuario.id,
      email: dados.email,
      emailVerificado: false,
    },
    {
      $set: {
        emailVerificado: true,
        emailVerificadoEm: new Date(),
      },
    }
  );

  expect(atualizacao.matchedCount).toBe(1);
  expect(atualizacao.modifiedCount).toBe(1);

  return dados;
}

async function fazerLogin(dados, userAgent = "") {
  const resposta = await request(app).post(`${BASE}/login`)
    .set("Origin", ORIGEM).set("User-Agent", userAgent).send({ email: dados.email, senha: dados.senha });
  expect(resposta.status).toBe(200);
  expect(resposta.body.data.accessToken).toBeTruthy();
  return resposta;
}

async function criarSessaoDeTeste() {
  const dados = await criarUsuario();

  const login = await fazerLogin(dados);

  return {
    dados,
    token: login.body.data.accessToken,
    cookie: obterCookie(login),
  };
}

beforeAll(async () => {
  const uri = obterUriDeTeste();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  if (
    mongoose.connection.name !==
    "clube_planner_test"
  ) {
    await mongoose.disconnect();

    throw new Error(
      "Conexão com banco inesperado."
    );
  }

  await User.init();
  await Session.init();
  await Order.init();
  await Payment.init();
  await Cart.init();
  await Review.init();
}, 30000);

beforeEach(async () => {
  vi.spyOn(shipping, "cotarFrete").mockImplementation(async (cep) => ({ cep, nivel: 2, valorCentavos: 600, distanciaKm: 25.18, metodo: "linha_reta_entre_ceps", origem: shippingRules.origem }));
  vi.stubEnv("CHECKOUT_TEST_MODE", "gratuito");
  await require("../src/services/catalogService").inicializarCatalogo({ estoqueInicial: 100 });
  await require("../src/models/product").updateMany({ "variacoes.lojaId": { $in: Array.from({ length: 12 }, (_, i) => i + 1) } }, { $set: { "variacoes.$[].estoqueDisponivel": 100, "variacoes.$[].estoqueReservado": 0 } });
  emailService.enviarLinkVerificacao = vi
    .fn()
    .mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  emailService.enviarLinkVerificacao =
    enviarEmailOriginal;

  if (usuariosCriados.size === 0) {
    return;
  }

  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !==
      "clube_planner_test"
  ) {
    throw new Error(
      "Limpeza interrompida: banco não autorizado."
    );
  }

  const ids = [...usuariosCriados].map(
    (id) => new mongoose.Types.ObjectId(id)
  );


  for (const model of [Order, Payment, Cart, Review]) await model.deleteMany({ userId: { $in: ids } });
  await require("../src/models/adminEvent").deleteMany({ actorId: { $in: ids } });
  await Session.deleteMany({
    userId: { $in: ids },
  });

  await User.deleteMany({
    _id: { $in: ids },
  });

  usuariosCriados.clear();
});

afterAll(async () => {
  emailService.enviarLinkVerificacao =
    enviarEmailOriginal;

  await mongoose.disconnect();
});


async function cliente() {
  const sessao = await criarSessaoDeTeste();
  const usuario = await User.findOne({ email: sessao.dados.email });
  usuario.enderecos.push({ pais: "Brasil", cep: "01001000", logradouro: "Praça da Sé", numero: "10", bairro: "Sé", cidade: "São Paulo", estado: "SP", principal: true });
  await usuario.save();
  return { ...sessao, userId: String(usuario._id), enderecoId: String(usuario.enderecos[0]._id) };
}
function compra(c, extra = {}) {
  return { itens: [{ id: 1, quantidade: 2 }], enderecoId: c.enderecoId, chave: randomUUID(), totalEsperadoCentavos: 600, freteEsperadoCentavos: 600, ...extra };
}
function post(c, path, dados) {
  return request(app).post(`${SHOP}${path}`).set("Origin", ORIGEM).set("Authorization", `Bearer ${c.token}`).send(dados);
}
function get(c, path) {
  return request(app).get(`${SHOP}${path}`).set("Authorization", `Bearer ${c.token}`);
}

describe("Loja: checkout com frete, pedidos e feedbacks", () => {
  it("persiste pedido pendente com frete e mantém snapshot do endereço", async () => {
    const c = await cliente();
    const provedor = vi.spyOn(mp, "criarPreferencia");
    const resposta = await post(c, "/checkout", compra(c));
    expect(resposta.status).toBe(201);
    const p = resposta.body.data.pedido;
    expect(p).toMatchObject({ status: "aguardando_pagamento", subtotalCentavos: 0, freteCentavos: 600, totalCentavos: 600, ambienteTeste: true, pagamentoTipo: "mercado_pago", pagamentoStatus: "pendente" });
    expect(provedor).not.toHaveBeenCalled();
    expect(await Payment.countDocuments({ userId: c.userId })).toBe(0);
    expect((await get(c, "/orders")).body.data.pedidos).toHaveLength(1);
    expect((await get(c, `/orders/${p.id}`)).body.data.pedido.itens[0]).toMatchObject({ nome: "Planner Semanal", quantidade: 2 });
    await User.updateOne({ _id: c.userId }, { $set: { "enderecos.0.numero": "999" } });
    expect((await get(c, `/orders/${p.id}`)).body.data.pedido.enderecoEntrega.numero).toBe("10");
    expect((await Cart.findOne({ userId: c.userId })).itens).toHaveLength(1);
  });
  it("duas confirmações simultâneas geram só um pedido e conteúdo diferente conflita", async () => {
    const c = await cliente();
    const dados = compra(c);
    const respostas = await Promise.all([post(c, "/checkout", dados), post(c, "/checkout", dados)]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201]);
    expect(respostas[0].body.data.pedido.id).toBe(respostas[1].body.data.pedido.id);
    expect(await Order.countDocuments({ userId: c.userId })).toBe(1);
    expect((await post(c, "/checkout", { ...dados, itens: [{ id: 2, quantidade: 1 }] })).status).toBe(409);
  });
  it("não permite endereço/pedido de outra conta, preço adulterado ou produto inexistente", async () => {
    const c = await cliente(); const outra = await cliente();
    expect((await post(c, "/checkout", compra(c, { enderecoId: outra.enderecoId }))).status).toBe(400);
    expect((await post(c, "/checkout", compra(c, { totalEsperadoCentavos: 100 }))).status).toBe(409);
    expect((await post(c, "/checkout", compra(c, { itens: [{ id: 99, quantidade: 1 }] }))).status).toBe(400);
    expect((await post(c, "/checkout", compra(c, { itens: [{ id: 1, quantidade: -1 }] }))).status).toBe(400);
    const p = (await post(c, "/checkout", compra(c))).body.data.pedido;
    expect((await get(outra, `/orders/${p.id}`)).status).toBe(404);
    expect((await get(outra, "/orders")).body.data.pedidos).toHaveLength(0);
    expect((await request(app).post(`${SHOP}/checkout`).send(compra(c))).status).toBe(401);
  });
  it("permite feedback apenas de produto comprado, atualiza sem duplicar e não expõe dados privados", async () => {
    const c = await cliente();
    expect((await post(c, "/products/1/reviews", { nota: 5, comentario: "Gostei" })).status).toBe(403);
    const criado = (await post(c, "/checkout", compra(c))).body.data.pedido;
    await orders.aplicarPagamento({ id: "123456", external_reference: criado.id, live_mode: false, currency_id: "BRL", transaction_amount: 6, status: "approved", date_last_updated: new Date().toISOString() });
    expect((await post(c, "/products/1/reviews", { nota: 5, comentario: "Gostei" })).status).toBe(200);
    expect((await post(c, "/products/1/reviews", { nota: 4, comentario: "Atualizado" })).status).toBe(200);
    expect((await post(c, "/products/2/reviews", { nota: 5, comentario: "Outro" })).status).toBe(403);
    expect(await Review.countDocuments({ userId: c.userId })).toBe(1);
    const review = (await get(c, "/products/1/reviews")).body.data.avaliacoes.find((r) => r.comentario === "Atualizado");
    expect(review.nota).toBe(4); expect(review).not.toHaveProperty("userId");
  });
  it("expõe a cotação e recusa frete adulterado ou indisponível sem criar pedido", async () => {
    const c = await cliente();
    const cotacao = await post(c, "/shipping-quote", { cep: "01001000" });
    expect(cotacao.status).toBe(200);
    expect(cotacao.body.data.frete).toMatchObject({ nivel: 2, valorCentavos: 600 });
    expect((await post(c, "/checkout", compra(c, { freteEsperadoCentavos: 300, totalEsperadoCentavos: 300 }))).status).toBe(409);
    expect((await post(c, "/checkout", compra(c, { freteCentavos: 0 }))).body.data.pedido.freteCentavos).toBe(600);
    const totalAntes = await Order.countDocuments({ userId: c.userId });
    shipping.cotarFrete.mockRejectedValueOnce(Object.assign(new Error("CEP não localizado"), { statusCode: 422 }));
    expect((await post(c, "/checkout", compra(c))).status).toBe(422);
    expect(await Order.countDocuments({ userId: c.userId })).toBe(totalAntes);
  });

  it("bloqueia checkout demonstrativo em produção", async () => {
    const c = await cliente();
    vi.stubEnv("NODE_ENV", "production");
    expect((await post(c, "/checkout", compra(c))).status).toBe(403);
  });
});

describe("Mercado Pago — confirmação consultada no servidor", () => {
  it("persiste pendente, confirma somente após aprovação, ignora evento antigo e registra reembolso", async () => {
    const c = await cliente();
    vi.stubEnv("CHECKOUT_TEST_MODE", "mercado_pago");
    const resposta = await post(c, "/checkout", compra(c, { totalEsperadoCentavos: 800 }));
    expect(resposta.status).toBe(201);
    const p = resposta.body.data.pedido;
    expect(p.status).toBe("aguardando_pagamento");
    const pagamento = { id: String(Date.now()), external_reference: p.id, live_mode: false, currency_id: "BRL", transaction_amount: 8, status: "pending", payment_type_id: "credit_card", date_last_updated: "2026-11-10T12:00:00Z" };
    vi.spyOn(mp, "buscarPagamentos").mockResolvedValue([pagamento]);
    expect((await post(c, `/orders/${p.id}/sync`, {})).body.data.pedido.status).toBe("aguardando_pagamento");
    pagamento.status = "approved"; pagamento.date_last_updated = "2026-11-10T12:01:00Z";
    const aprovado = await post(c, `/orders/${p.id}/sync`, {});
    expect(aprovado.status).toBe(200);
    expect(aprovado.body.data.pedido.status).toBe("pago");
    await post(c, `/orders/${p.id}/sync`, {});
    expect(await Payment.countDocuments({ orderId: p.id })).toBe(1);
    await orders.aplicarPagamento({ ...pagamento, status: "pending", date_last_updated: "2026-11-10T12:00:00Z" });
    expect((await get(c, `/orders/${p.id}`)).body.data.pedido.status).toBe("pago");
    await orders.aplicarPagamento({ ...pagamento, status: "refunded", date_last_updated: "2026-11-10T12:02:00Z" });
    expect((await get(c, `/orders/${p.id}`)).body.data.pedido.status).toBe("cancelado");
  });
  it("rejeita moeda, valor e ambiente incorretos e não aprova por parâmetros de retorno", async () => {
    const c = await cliente(); vi.stubEnv("CHECKOUT_TEST_MODE", "mercado_pago");
    const p = (await post(c, "/checkout", compra(c, { totalEsperadoCentavos: 800 }))).body.data.pedido;
    const dados = { id: "123", external_reference: p.id, live_mode: false, currency_id: "BRL", transaction_amount: 8, status: "approved", date_last_updated: new Date().toISOString() };
    for (const alteracao of [{ currency_id: "USD" }, { transaction_amount: 1 }, { live_mode: true }]) {
      await expect(orders.aplicarPagamento({ ...dados, ...alteracao })).rejects.toThrow();
    }
    expect((await get(c, `/orders/${p.id}?status=approved&collection_status=approved`)).body.data.pedido.status).toBe("aguardando_pagamento");
    expect((await request(app).post(`${SHOP}/mercado-pago/webhook?data.id=123`).send({ status: "approved" })).status).toBe(401);
  });
  it("valida webhook assinado e trata repetição sem duplicar pagamento", async () => {
    const { createHmac } = await import("node:crypto");
    const c = await cliente(); vi.stubEnv("CHECKOUT_TEST_MODE", "mercado_pago"); vi.stubEnv("MP_WEBHOOK_SECRET", "segredo-de-teste");
    const p = (await post(c, "/checkout", compra(c, { totalEsperadoCentavos: 800 }))).body.data.pedido;
    const id = "987654321"; const ts = String(Date.now()); const requestId = randomUUID();
    const assinatura = createHmac("sha256", "segredo-de-teste").update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex");
    vi.spyOn(mp, "consultarPagamento").mockResolvedValue({ id, external_reference: p.id, live_mode: false, currency_id: "BRL", transaction_amount: 8, status: "approved", date_last_updated: new Date().toISOString() });
    for (let i = 0; i < 2; i++) {
      const r = await request(app).post(`${SHOP}/mercado-pago/webhook?data.id=${id}`).set("x-signature", `ts=${ts},v1=${assinatura}`).set("x-request-id", requestId).send({ type: "payment", data: { id } });
      expect(r.status).toBe(200);
    }
    expect((await get(c, `/orders/${p.id}`)).body.data.pedido.status).toBe("pago");
    expect(await Payment.countDocuments({ orderId: p.id })).toBe(1);
  });
  it("retoma preferência persistida sem criar outra", async () => {
    const c = await cliente(); vi.stubEnv("CHECKOUT_TEST_MODE", "mercado_pago");
    const p = (await post(c, "/checkout", compra(c, { totalEsperadoCentavos: 800 }))).body.data.pedido;
    const criar = vi.spyOn(mp, "criarPreferencia").mockResolvedValue({ preferenceId: "pref-test", checkoutUrl: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-test" });
    expect((await post(c, `/orders/${p.id}/payment`, {})).status).toBe(200);
    expect((await post(c, `/orders/${p.id}/payment`, {})).status).toBe(200);
    expect(criar).toHaveBeenCalledTimes(1);
  });
});

describe('Cancelamento pela conta do cliente', () => {
  it('cancela pendente, repete com segurança e bloqueia pagamento e outra conta', async () => {
    const c = await cliente(); const outra = await cliente();
    const p = (await post(c, '/checkout', compra(c))).body.data.pedido;
    expect((await post(outra, `/orders/${p.id}/cancel`, {})).status).toBe(404);
    const cancelado = await post(c, `/orders/${p.id}/cancel`, {});
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.data.pedido.status).toBe('cancelado');
    expect(cancelado.body.data.pedido.cancelamentoSolicitadoEm).toBeTruthy();
    expect((await post(c, `/orders/${p.id}/cancel`, {})).status).toBe(200);
    expect((await post(c, `/orders/${p.id}/payment`, {})).status).toBe(409);
  });
  it('reembolsa pedido pago integralmente e não duplica o reembolso', async () => {
    const c = await cliente();
    const p = (await post(c, '/checkout', compra(c))).body.data.pedido;
    const pagamento = { id: '7654321', external_reference: p.id, live_mode: false, currency_id: 'BRL', transaction_amount: 6, status: 'approved', date_last_updated: new Date().toISOString() };
    await orders.aplicarPagamento(pagamento);
    vi.spyOn(mp, 'encerrarPreferencia').mockResolvedValue({});
    const reembolsado = { ...pagamento, status: 'refunded', date_last_updated: new Date(Date.now() + 1000).toISOString() };
    vi.spyOn(mp, 'buscarPagamentos').mockResolvedValue([pagamento]);
    vi.spyOn(mp, 'cancelarOuReembolsar').mockResolvedValue(reembolsado);
    const resposta = await post(c, `/orders/${p.id}/cancel`, {});
    expect(resposta.status).toBe(200);
    expect(resposta.body.data.pedido).toMatchObject({ status: 'cancelado', pagamentoStatus: 'reembolsado', totalCentavos: 600 });
    expect((await Payment.findOne({ orderId: p.id })).refundSucceededCentavos).toBe(600);
    mp.buscarPagamentos.mockResolvedValue([reembolsado]);
    expect((await post(c, `/orders/${p.id}/cancel`, {})).status).toBe(200);
    expect((await Payment.findOne({ orderId: p.id })).refundSucceededCentavos).toBe(600);
  });
  it('recusa cancelamento depois de entregue', async () => {
    const c = await cliente();
    const p = (await post(c, '/checkout', compra(c))).body.data.pedido;
    await Order.updateOne({ _id: p.id }, { $set: { status: 'entregue' } });
    expect((await post(c, `/orders/${p.id}/cancel`, {})).status).toBe(409);
  });
  it('reembolsa aprovação tardia após cancelamento sem reativar o pedido', async () => {
    const c = await cliente();
    const p = (await post(c, '/checkout', compra(c))).body.data.pedido;
    await post(c, `/orders/${p.id}/cancel`, {});
    const pagamento = { id: '7654322', external_reference: p.id, live_mode: false, currency_id: 'BRL', transaction_amount: 6, status: 'approved', date_last_updated: new Date().toISOString() };
    vi.spyOn(mp, 'cancelarOuReembolsar').mockResolvedValue({ ...pagamento, status: 'refunded', date_last_updated: new Date(Date.now() + 1000).toISOString() });
    await orders.aplicarPagamento(pagamento);
    const atualizado = (await get(c, `/orders/${p.id}`)).body.data.pedido;
    expect(atualizado).toMatchObject({ status: 'cancelado', pagamentoStatus: 'reembolsado' });
    expect((await Payment.findOne({ orderId: p.id })).refundSucceededCentavos).toBe(600);
  });
});
