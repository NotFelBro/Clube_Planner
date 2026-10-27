
import "dotenv/config";

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";

import mongoose from "mongoose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const User = require("../src/models/User");
const Product = require("../src/models/product");
const Cart = require("../src/models/cart");
const Order = require("../src/models/order");

const {
  criarPedidoCheckout,
} = require("../src/services/checkoutService");

const usuariosCriados = [];
const produtosCriados = [];

function obterUriTeste() {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error("MONGODB_TEST_URI não configurada.");
  }

  const banco = decodeURIComponent(
    new URL(uri).pathname.slice(1)
  );

  if (banco !== "clube_planner_test") {
    throw new Error("Banco de testes não autorizado.");
  }

  return uri;
}

async function criarUsuario() {
  const usuario = await User.create({
    nome: "Cliente Checkout Integração",
    email: `integracao-${new mongoose.Types.ObjectId()}@example.com`,
    cpf: "52998224725",
    telefone: "11999999999",
    senhaHash: "hash-ficticio-para-teste",
    ativo: true,
    enderecos: [
      {
        cep: "13010000",
        logradouro: "Rua de Exemplo",
        numero: "100",
        complemento: "",
        bairro: "Centro",
        cidade: "Campinas",
        estado: "SP",
        principal: true,
      },
    ],
  });

  usuariosCriados.push(usuario._id);

  expect(usuario.enderecos).toHaveLength(1);

  return usuario;
}

async function criarProduto({
  estoque = 5,
  precoCentavos = 2000,
} = {}) {
  const identificador = new mongoose.Types.ObjectId()
    .toHexString();

  const produto = await Product.create({
    nome: "Planner de Integração",
    slug: `planner-integracao-${identificador}`,
    descricao: "Produto exclusivo para testes.",
    categoriaId: new mongoose.Types.ObjectId(),
    imagens: [],
    variacoes: [
      {
        sku: `INTEGRACAO-${identificador.toUpperCase()}`,
        atributos: {
          cor: "Azul",
        },
        precoCentavos,
        estoqueDisponivel: estoque,
        estoqueReservado: 0,
        ativo: true,
      },
    ],
    ativo: true,
  });

  produtosCriados.push(produto._id);

  return produto;
}

async function criarCarrinho(usuario, itens) {
  return Cart.create({
    userId: usuario._id,
    itens,
    couponId: null,
  });
}

function itemCarrinho(produto, quantidade) {
  return {
    productId: produto._id,
    variantId: produto.variacoes[0]._id,
    quantidade,
  };
}

function parametrosCheckout(
  usuario,
  chave,
  itens,
  couponId = null
) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error(
      "O teste deve informar os itens do checkout."
    );
  }

  return {
    userId: usuario._id,
    enderecoId: usuario.enderecos[0]._id,
    checkoutIdempotencyKey: chave,
    itens: itens.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantidade: item.quantidade,
    })),
    couponId,
  };
}

beforeAll(async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "NODE_ENV deve ser test para executar esta suíte."
    );
  }

  await mongoose.connect(obterUriTeste(), {
    serverSelectionTimeoutMS: 5000,
  });

  if (mongoose.connection.name !== "clube_planner_test") {
    await mongoose.disconnect();
    throw new Error("Conexão com banco inesperado.");
  }

  await Promise.all([
    User.init(),
    Product.init(),
    Cart.init(),
    Order.init(),
  ]);
}, 120000);

afterEach(async () => {
  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== "clube_planner_test"
  ) {
    throw new Error(
      "Limpeza bloqueada: banco inesperado."
    );
  }

  // Limpeza limitada aos registros criados pelos testes.
  if (usuariosCriados.length > 0) {
    await Cart.deleteMany({
      userId: { $in: usuariosCriados },
    });

    await Order.deleteMany({
      userId: { $in: usuariosCriados },
    });

    await User.deleteMany({
      _id: { $in: usuariosCriados },
    });
  }

  if (produtosCriados.length > 0) {
    await Product.deleteMany({
      _id: { $in: produtosCriados },
    });
  }

  usuariosCriados.length = 0;
  produtosCriados.length = 0;
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("Criação transacional do checkout", () => {
  it("cria pedido com snapshots e reserva estoque", async () => {
    const usuario = await criarUsuario();
    const produto = await criarProduto();

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const pedido = await criarPedidoCheckout(
      parametrosCheckout(
        usuario,
        "checkout-integracao-001",
        [itemCarrinho(produto, 2)]
      )
    );

    expect(pedido.status).toBe("aguardando_pagamento");
    expect(pedido.reserva.status).toBe("reservado");

    expect(pedido.subtotalCentavos).toBe(4000);
    expect(pedido.descontoCentavos).toBe(0);
    expect(pedido.freteCentavos).toBe(0);
    expect(pedido.totalCentavos).toBe(4000);

    expect(pedido.itens).toHaveLength(1);
    expect(pedido.itens[0].nomeProduto).toBe(
      "Planner de Integração"
    );
    expect(pedido.itens[0].sku).toBe(
      produto.variacoes[0].sku
    );
    expect(pedido.itens[0].quantidade).toBe(2);
    expect(pedido.itens[0].precoUnitarioCentavos).toBe(
      2000
    );

    expect(pedido.enderecoEntrega.cep).toBe(
      "13010000"
    );

    const atualizado = await Product.findById(
      produto._id
    );

    const variacao = atualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);

    const persistido = await Order.findById(
      pedido._id
    );

    expect(persistido).not.toBeNull();
    expect(persistido.checkoutRequestFingerprint)
      .toMatch(/^[a-f0-9]{64}$/);
  });

  it("reutiliza o pedido original após alteração do carrinho", async () => {
    const usuario = await criarUsuario();

    const produto = await criarProduto({
      estoque: 10,
      precoCentavos: 2000,
    });

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const parametros = parametrosCheckout(
      usuario,
      "checkout-carrinho-alterado-001",
      [itemCarrinho(produto, 2)]
    );

    const primeiroPedido = await criarPedidoCheckout(
      parametros
    );

    expect(primeiroPedido.itens[0].quantidade).toBe(2);

    await Cart.updateOne(
      { userId: usuario._id },
      {
        $set: {
          "itens.0.quantidade": 3,
        },
      }
    );

    const segundoPedido = await criarPedidoCheckout(
      parametros
    );

    expect(String(segundoPedido._id)).toBe(
      String(primeiroPedido._id)
    );

    expect(segundoPedido.itens[0].quantidade).toBe(2);

    const produtoAtualizado = await Product.findById(
      produto._id
    );

    const variacao = produtoAtualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(8);
    expect(variacao.estoqueReservado).toBe(2);

    const quantidadePedidos = await Order.countDocuments({
      userId: usuario._id,
      checkoutIdempotencyKey:
        "checkout-carrinho-alterado-001",
    });

    expect(quantidadePedidos).toBe(1);
  });

  it("rejeita a mesma chave com uma nova intenção de compra", async () => {
    const usuario = await criarUsuario();

    const produto = await criarProduto({
      estoque: 10,
      precoCentavos: 2000,
    });

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const parametros = parametrosCheckout(
      usuario,
      "checkout-conflito-intencao-001",
      [itemCarrinho(produto, 2)]
    );

    const primeiroPedido = await criarPedidoCheckout(
      parametros
    );

    expect(primeiroPedido.itens[0].quantidade).toBe(2);

    const novaSolicitacao = {
      ...parametros,
      itens: [itemCarrinho(produto, 3)],
    };

    await expect(
      criarPedidoCheckout(novaSolicitacao)
    ).rejects.toThrow("Conflito de idempotência.");

    const pedidos = await Order.countDocuments({
      userId: usuario._id,
      checkoutIdempotencyKey:
        "checkout-conflito-intencao-001",
    });

    expect(pedidos).toBe(1);

    const produtoAtualizado = await Product.findById(
      produto._id
    );

    const variacao = produtoAtualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(8);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("não duplica pedidos em requisições simultâneas", async () => {
    const usuario = await criarUsuario();

    const produto = await criarProduto({
      estoque: 5,
      precoCentavos: 2000,
    });

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const parametros = parametrosCheckout(
      usuario,
      "checkout-concorrencia-001",
      [itemCarrinho(produto, 2)]
    );

    const resultados = await Promise.allSettled([
      criarPedidoCheckout(parametros),
      criarPedidoCheckout(parametros),
    ]);

    const aprovados = resultados.filter(
      (resultado) => resultado.status === "fulfilled"
    );

    const rejeitados = resultados.filter(
      (resultado) => resultado.status === "rejected"
    );

    expect(
      rejeitados.map(
        (resultado) => resultado.reason?.message
      )
    ).toEqual([]);

    expect(aprovados).toHaveLength(2);

    const ids = aprovados.map(
      (resultado) => String(resultado.value._id)
    );

    expect(new Set(ids).size).toBe(1);

    const pedidos = await Order.find({
      userId: usuario._id,
      checkoutIdempotencyKey:
        "checkout-concorrencia-001",
    });

    expect(pedidos).toHaveLength(1);

    const atualizado = await Product.findById(
      produto._id
    );

    const variacao = atualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("detecta reutilização da chave com endereço diferente", async () => {
    const usuario = await criarUsuario();
    const produto = await criarProduto();

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const chave = "checkout-conflito-endereco-001";

    const parametros = parametrosCheckout(
      usuario,
      chave,
      [itemCarrinho(produto, 2)]
    );

    const primeiro = await criarPedidoCheckout(
      parametros
    );

    const outroEnderecoId =
      new mongoose.Types.ObjectId();

    await expect(
      criarPedidoCheckout({
        ...parametros,
        enderecoId: outroEnderecoId,
      })
    ).rejects.toThrow("Conflito de idempotência.");

    const pedidos = await Order.find({
      userId: usuario._id,
      checkoutIdempotencyKey: chave,
    });

    expect(pedidos).toHaveLength(1);
    expect(String(pedidos[0]._id)).toBe(
      String(primeiro._id)
    );

    const atualizado = await Product.findById(
      produto._id
    );

    const variacao = atualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("reutiliza a mesma chave sem duplicar reservas", async () => {
    const usuario = await criarUsuario();
    const produto = await criarProduto();

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    const parametros = parametrosCheckout(
      usuario,
      "checkout-integracao-002",
      [itemCarrinho(produto, 2)]
    );

    const primeiro = await criarPedidoCheckout(
      parametros
    );

    const segundo = await criarPedidoCheckout(
      parametros
    );

    expect(String(segundo._id)).toBe(
      String(primeiro._id)
    );

    const quantidadePedidos = await Order.countDocuments({
      userId: usuario._id,
      checkoutIdempotencyKey:
        "checkout-integracao-002",
    });

    expect(quantidadePedidos).toBe(1);

    const atualizado = await Product.findById(
      produto._id
    );

    const variacao = atualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(3);
    expect(variacao.estoqueReservado).toBe(2);
  });

  it("rejeita checkout com estoque insuficiente", async () => {
    const usuario = await criarUsuario();

    const produto = await criarProduto({
      estoque: 1,
    });

    await criarCarrinho(usuario, [
      itemCarrinho(produto, 2),
    ]);

    await expect(
      criarPedidoCheckout(
        parametrosCheckout(
          usuario,
          "checkout-integracao-003",
          [itemCarrinho(produto, 2)]
        )
      )
    ).rejects.toThrow(
      "Produto indisponível ou estoque insuficiente."
    );

    const atualizado = await Product.findById(
      produto._id
    );

    const variacao = atualizado.variacoes.id(
      produto.variacoes[0]._id
    );

    expect(variacao.estoqueDisponivel).toBe(1);
    expect(variacao.estoqueReservado).toBe(0);

    expect(
      await Order.countDocuments({
        userId: usuario._id,
      })
    ).toBe(0);
  });

  it("desfaz reservas anteriores quando um item falha", async () => {
    const usuario = await criarUsuario();

    const produtoDisponivel = await criarProduto({
      estoque: 5,
    });

    const produtoInsuficiente = await criarProduto({
      estoque: 1,
    });

    const itens = [
      itemCarrinho(produtoDisponivel, 2),
      itemCarrinho(produtoInsuficiente, 3),
    ];

    await criarCarrinho(usuario, itens);

    await expect(
      criarPedidoCheckout(
        parametrosCheckout(
          usuario,
          "checkout-integracao-004",
          itens
        )
      )
    ).rejects.toThrow(
      "Produto indisponível ou estoque insuficiente."
    );

    const primeiro = await Product.findById(
      produtoDisponivel._id
    );

    const segundo = await Product.findById(
      produtoInsuficiente._id
    );

    const variacaoPrimeiro = primeiro.variacoes.id(
      produtoDisponivel.variacoes[0]._id
    );

    const variacaoSegundo = segundo.variacoes.id(
      produtoInsuficiente.variacoes[0]._id
    );

    expect(variacaoPrimeiro.estoqueDisponivel).toBe(5);
    expect(variacaoPrimeiro.estoqueReservado).toBe(0);

    expect(variacaoSegundo.estoqueDisponivel).toBe(1);
    expect(variacaoSegundo.estoqueReservado).toBe(0);

    expect(
      await Order.countDocuments({
        userId: usuario._id,
      })
    ).toBe(0);
  });
});
