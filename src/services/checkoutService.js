
const mongoose = require("mongoose");

const Product = require("../models/product");
const Coupon = require("../models/coupons");
const CouponRedemption = require("../models/couponRedemption");
const Cart = require("../models/cart");
const Order = require("../models/order");

const {
  obterEnderecoParaCheckout,
} = require("./addressService");

const {
  calcularDesconto,
} = require("./discountService");

const {
  alocarDesconto,
} = require("./allocationService");

const {
  calcularCheckoutFingerprint,
} = require("./checkoutFingerprint");

/**
 * Executa uma operação dentro de uma transação MongoDB.
 */
async function executarTransacao(operacao) {
  if (typeof operacao !== "function") {
    throw new TypeError("A operação deve ser uma função.");
  }

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      return operacao(session);
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Reserva estoque de uma variação de produto.
 */
async function reservarEstoque({
  productId,
  variantId,
  quantidade,
  session,
}) {
  if (!session) {
    throw new Error("Sessão MongoDB obrigatória.");
  }

  if (
    !Number.isSafeInteger(quantidade) ||
    quantidade <= 0
  ) {
    throw new Error("Quantidade inválida.");
  }

  if (
    !mongoose.isObjectIdOrHexString(productId) ||
    !mongoose.isObjectIdOrHexString(variantId)
  ) {
    throw new Error("Identificador inválido.");
  }

  const resultado = await Product.updateOne(
    {
      _id: productId,
      ativo: true,
      variacoes: {
        $elemMatch: {
          _id: variantId,
          ativo: true,
          estoqueDisponivel: {
            $gte: quantidade,
          },
        },
      },
    },
    {
      $inc: {
        "variacoes.$.estoqueDisponivel": -quantidade,
        "variacoes.$.estoqueReservado": quantidade,
      },
    },
    { session }
  );

  if (resultado.modifiedCount !== 1) {
    throw new Error(
      "Produto indisponível ou estoque insuficiente."
    );
  }

  return {
    productId,
    variantId,
    quantidade,
    reservado: true,
  };
}

/**
 * Reserva um cupom para um pedido.
 *
 * A reserva é idempotente para chamadas sequenciais
 * com o mesmo pedido e o mesmo cupom.
 */
async function reservarCupom({
  couponId,
  userId,
  orderId,
  subtotalCentavos,
  session,
}) {
  if (!session) {
    throw new Error("Sessão MongoDB obrigatória.");
  }

  if (
    ![couponId, userId, orderId].every((id) =>
      mongoose.isObjectIdOrHexString(id)
    )
  ) {
    throw new Error("Identificador inválido.");
  }

  if (
    !Number.isSafeInteger(subtotalCentavos) ||
    subtotalCentavos < 0
  ) {
    throw new Error("Subtotal inválido.");
  }

  // 1. Verificar reserva existente antes dos limites.
  const existente = await CouponRedemption.findOne({
    orderId,
    couponId,
  }).session(session);

  if (existente) {
    if (String(existente.userId) !== String(userId)) {
      throw new Error(
        "Reserva vinculada a outro usuário."
      );
    }

    if (existente.status === "released") {
      throw new Error(
        "A reserva deste pedido já foi liberada."
      );
    }

    const cupomExistente = await Coupon.findById(
      couponId
    ).session(session);

    if (!cupomExistente) {
      throw new Error("Cupom não encontrado.");
    }

    return {
      couponId: cupomExistente._id,
      redemptionId: existente._id,
      codigo: cupomExistente.codigo,
      tipo: cupomExistente.tipo,
      valor: cupomExistente.valor,
      reservado: existente.status === "reserved",
      reutilizado: true,
      status: existente.status,
    };
  }

  // 2. Validar o cupom.
  const agora = new Date();

  const cupom = await Coupon.findOne({
    _id: couponId,
    ativo: true,
    inicioEm: { $lte: agora },
    expiraEm: { $gt: agora },
    pedidoMinimoCentavos: {
      $lte: subtotalCentavos,
    },
  }).session(session);

  if (!cupom) {
    throw new Error("Cupom inválido ou indisponível.");
  }

  // 3. Validar o limite por usuário.
  if (cupom.limiteUsosPorUsuario !== null) {
    const utilizacoes =
      await CouponRedemption.countDocuments({
        couponId,
        userId,
        status: {
          $in: ["reserved", "consumed"],
        },
      }).session(session);

    if (utilizacoes >= cupom.limiteUsosPorUsuario) {
      throw new Error(
        "Limite de utilizações por usuário atingido."
      );
    }
  }

  // 4. Preparar a atualização atômica.
  const filtro = {
    _id: couponId,
    ativo: true,
    inicioEm: { $lte: agora },
    expiraEm: { $gt: agora },
    pedidoMinimoCentavos: {
      $lte: subtotalCentavos,
    },
  };

  if (cupom.limiteUsos !== null) {
    filtro.$expr = {
      $lt: [
        {
          $add: [
            "$usosRealizados",
            "$usosReservados",
          ],
        },
        "$limiteUsos",
      ],
    };
  }

  // 5. Reservar a utilização.
  const resultado = await Coupon.updateOne(
    filtro,
    {
      $inc: {
        usosReservados: 1,
        revisaoUso: 1,
      },
    },
    { session }
  );

  if (resultado.modifiedCount !== 1) {
    throw new Error(
      "Limite global de utilizações atingido."
    );
  }

  // 6. Registrar a reserva.
  const [reserva] = await CouponRedemption.create(
    [
      {
        couponId,
        userId,
        orderId,
        status: "reserved",
      },
    ],
    { session }
  );

  return {
    couponId: cupom._id,
    redemptionId: reserva._id,
    codigo: cupom.codigo,
    tipo: cupom.tipo,
    valor: cupom.valor,
    reservado: true,
    reutilizado: false,
    status: "reserved",
  };
}

/**
 * Consome uma reserva de cupom.
 *
 * Transição permitida:
 * reserved -> consumed
 *
 * Chamadas repetidas após o consumo
 * não alteram os contadores.
 */
async function consumirCupom({ redemptionId, session }) {
  if (!session) {
    throw new Error("Sessão MongoDB obrigatória.");
  }

  if (!mongoose.isObjectIdOrHexString(redemptionId)) {
    throw new Error("Identificador inválido.");
  }

  const reserva = await CouponRedemption.findById(
    redemptionId
  ).session(session);

  if (!reserva) {
    throw new Error(
      "Reserva de cupom não encontrada."
    );
  }

  if (reserva.status === "consumed") {
    return {
      redemptionId: reserva._id,
      status: "consumed",
      reutilizado: true,
    };
  }

  if (reserva.status === "released") {
    throw new Error(
      "Uma reserva liberada não pode ser consumida."
    );
  }

  const agora = new Date();

  const resultado = await CouponRedemption.updateOne(
    {
      _id: redemptionId,
      status: "reserved",
    },
    {
      $set: {
        status: "consumed",
        consumedAt: agora,
      },
    },
    { session }
  );

  if (resultado.modifiedCount !== 1) {
    throw new Error(
      "Não foi possível consumir a reserva."
    );
  }

  const cupom = await Coupon.updateOne(
    {
      _id: reserva.couponId,
      usosReservados: { $gte: 1 },
    },
    {
      $inc: {
        usosReservados: -1,
        usosRealizados: 1,
        revisaoUso: 1,
      },
    },
    { session }
  );

  if (cupom.modifiedCount !== 1) {
    throw new Error(
      "Falha ao atualizar os contadores do cupom."
    );
  }

  return {
    redemptionId: reserva._id,
    status: "consumed",
    reutilizado: false,
  };
}

/**
 * Libera uma reserva de cupom.
 *
 * Transição permitida:
 * reserved -> released
 *
 * Chamadas repetidas após a liberação
 * não alteram os contadores.
 */
async function liberarCupom({ redemptionId, session }) {
  if (!session) {
    throw new Error("Sessão MongoDB obrigatória.");
  }

  if (!mongoose.isObjectIdOrHexString(redemptionId)) {
    throw new Error("Identificador inválido.");
  }

  const reserva = await CouponRedemption.findById(
    redemptionId
  ).session(session);

  if (!reserva) {
    throw new Error(
      "Reserva de cupom não encontrada."
    );
  }

  if (reserva.status === "released") {
    return {
      redemptionId: reserva._id,
      status: "released",
      reutilizado: true,
    };
  }

  if (reserva.status === "consumed") {
    throw new Error(
      "Uma reserva consumida não pode ser liberada."
    );
  }

  const agora = new Date();

  const resultado = await CouponRedemption.updateOne(
    {
      _id: redemptionId,
      status: "reserved",
    },
    {
      $set: {
        status: "released",
        releasedAt: agora,
      },
    },
    { session }
  );

  if (resultado.modifiedCount !== 1) {
    throw new Error(
      "Não foi possível liberar a reserva."
    );
  }

  const cupom = await Coupon.updateOne(
    {
      _id: reserva.couponId,
      usosReservados: { $gte: 1 },
    },
    {
      $inc: {
        usosReservados: -1,
        revisaoUso: 1,
      },
    },
    { session }
  );

  if (cupom.modifiedCount !== 1) {
    throw new Error(
      "Falha ao atualizar os contadores do cupom."
    );
  }

  return {
    redemptionId: reserva._id,
    status: "released",
    reutilizado: false,
  };
}

/**
 * Valida a reutilização de uma chave de idempotência.
 *
 * Pedidos antigos sem fingerprint ou enderecoOrigemId
 * são rejeitados de forma conservadora.
 */
function validarIdempotenciaCheckout(
  pedido,
  enderecoId,
  fingerprint
) {
  if (!pedido) {
    return;
  }

  if (
    !pedido.enderecoOrigemId ||
    String(pedido.enderecoOrigemId) !== String(enderecoId)
  ) {
    throw new Error("Conflito de idempotência.");
  }

  if (
    !pedido.checkoutRequestFingerprint ||
    pedido.checkoutRequestFingerprint !== fingerprint
  ) {
    throw new Error("Conflito de idempotência.");
  }
}

/**
 * Cria um pedido de checkout de forma transacional.
 *
 * O frete provisório é permitido exclusivamente
 * no banco de testes.
 */
async function criarPedidoCheckout({
  userId,
  enderecoId,
  checkoutIdempotencyKey,
  itens,
  couponId,
}) {
  // 1. Validar os identificadores.
  if (
    !mongoose.isObjectIdOrHexString(userId) ||
    !mongoose.isObjectIdOrHexString(enderecoId)
  ) {
    throw new Error("Identificador inválido.");
  }

  // 2. Validar a chave de idempotência.
  if (
    typeof checkoutIdempotencyKey !== "string" ||
    checkoutIdempotencyKey.trim().length < 8 ||
    checkoutIdempotencyKey.trim().length > 128
  ) {
    throw new Error("Chave de idempotência inválida.");
  }

  const chave = checkoutIdempotencyKey.trim();

  // 3. Validar os itens solicitados.
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error(
      "Itens do checkout obrigatórios."
    );
  }

  if (couponId === undefined) {
    throw new Error(
      "Cupom do checkout deve ser informado."
    );
  }

  // 4. Calcular o fingerprint da solicitação.
  const fingerprint = calcularCheckoutFingerprint({
    enderecoId,
    itens,
    couponId,
  });

  // 5. Bloquear frete fictício fora dos testes.
  if (
    process.env.NODE_ENV !== "test" ||
    mongoose.connection.name !== "clube_planner_test"
  ) {
    throw new Error(
      "Checkout indisponível: cálculo de frete não configurado."
    );
  }

  const filtroIdempotencia = {
    userId,
    checkoutIdempotencyKey: chave,
  };

  // CAMINHO 1:
  // Verificar se o pedido já existe antes da transação.
  const pedidoExistente = await Order.findOne(
    filtroIdempotencia
  );

  if (pedidoExistente) {
    validarIdempotenciaCheckout(
      pedidoExistente,
      enderecoId,
      fingerprint
    );

    return pedidoExistente;
  }

  try {
    return await executarTransacao(async (session) => {
      // CAMINHO 2:
      // Verificar novamente dentro da transação.
      const existente = await Order.findOne(
        filtroIdempotencia
      ).session(session);

      if (existente) {
        validarIdempotenciaCheckout(
          existente,
          enderecoId,
          fingerprint
        );

        return existente;
      }

      // 6. Consultar o carrinho.
      const carrinho = await Cart.findOne({
        userId,
      }).session(session);

      if (
        !carrinho ||
        !Array.isArray(carrinho.itens) ||
        carrinho.itens.length === 0
      ) {
        throw new Error(
          "Carrinho vazio ou inexistente."
        );
      }

      // 7. Verificar se a solicitação corresponde
      // ao carrinho persistido.
      const fingerprintCarrinho =
        calcularCheckoutFingerprint({
          enderecoId,
          itens: carrinho.itens.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantidade: item.quantidade,
          })),
          couponId: carrinho.couponId ?? null,
        });

      if (fingerprintCarrinho !== fingerprint) {
        throw new Error(
          "A solicitação de checkout não corresponde ao carrinho."
        );
      }

      // 8. Obter o endereço de entrega.
      const enderecoEntrega =
        await obterEnderecoParaCheckout({
          userId,
          enderecoId,
          session,
        });

      const itensPedido = [];
      let subtotalCentavos = 0;

      // 9. Validar produtos e reservar estoque.
      // Operações sequenciais dentro da sessão.
      for (const item of carrinho.itens) {
        if (
          !Number.isSafeInteger(item.quantidade) ||
          item.quantidade <= 0
        ) {
          throw new Error("Quantidade inválida.");
        }

        const produto = await Product.findOne({
          _id: item.productId,
          ativo: true,
        }).session(session);

        if (!produto) {
          throw new Error(
            "Produto indisponível no carrinho."
          );
        }

        const variacao = produto.variacoes.id(
          item.variantId
        );

        if (!variacao || !variacao.ativo) {
          throw new Error(
            "Variação indisponível no carrinho."
          );
        }

        const preco = variacao.precoCentavos;
        const quantidade = item.quantidade;

        if (
          !Number.isSafeInteger(preco) ||
          preco < 0
        ) {
          throw new Error("Preço inválido.");
        }

        const subtotalItem = preco * quantidade;

        if (!Number.isSafeInteger(subtotalItem)) {
          throw new Error(
            "Subtotal do item excede o limite permitido."
          );
        }

        subtotalCentavos += subtotalItem;

        if (!Number.isSafeInteger(subtotalCentavos)) {
          throw new Error(
            "Subtotal do pedido excede o limite permitido."
          );
        }

        // Reserva atômica de estoque.
        await reservarEstoque({
          productId: produto._id,
          variantId: variacao._id,
          quantidade,
          session,
        });

        const atributos = variacao.atributos
          ? Object.fromEntries(variacao.atributos)
          : {};

        // Snapshot do produto no momento do checkout.
        itensPedido.push({
          lineId: `line_${itensPedido.length + 1}`,
          productId: produto._id,
          variantId: variacao._id,
          nomeProduto: produto.nome,
          sku: variacao.sku,
          atributos,
          quantidade,
          precoUnitarioCentavos: preco,
          subtotalCentavos: subtotalItem,
        });
      }

      // 10. Preparar o pedido.
      const orderId = new mongoose.Types.ObjectId();

      let descontoCentavos = 0;
      let couponIdPedido = null;
      let codigoCupom = null;

      // 11. Reservar cupom, se existir.
      if (carrinho.couponId) {
        const reservaCupom = await reservarCupom({
          couponId: carrinho.couponId,
          userId,
          orderId,
          subtotalCentavos,
          session,
        });

        descontoCentavos = calcularDesconto({
          subtotalCentavos,
          tipo: reservaCupom.tipo,
          valor: reservaCupom.valor,
        });

        couponIdPedido = reservaCupom.couponId;
        codigoCupom = reservaCupom.codigo;
      }

      // Ratear o desconto entre os itens do pedido.
      const itensComRateio = alocarDesconto(
        itensPedido,
        descontoCentavos
      );

      // 12. Calcular o total.
      // Frete provisório: somente no ambiente de testes.
      const freteCentavos = 0;

      const totalCentavos =
        subtotalCentavos -
        descontoCentavos +
        freteCentavos;

      if (
        !Number.isSafeInteger(totalCentavos) ||
        totalCentavos < 0
      ) {
        throw new Error(
          "Total do pedido inválido."
        );
      }

      // 13. Definir o prazo da reserva.
      // Margem de segurança para o limite de 15 minutos.
      const expiresAt = new Date(
        Date.now() + 14 * 60 * 1000
      );

      // 14. Criar o pedido na mesma transação.
      const [pedido] = await Order.create(
        [
          {
            _id: orderId,
            userId,

            checkoutIdempotencyKey: chave,
            checkoutRequestFingerprint: fingerprint,

            enderecoOrigemId: enderecoId,

            itens: itensComRateio,
            enderecoEntrega,

            subtotalCentavos,
            descontoCentavos,
            freteCentavos,
            totalCentavos,

            couponId: couponIdPedido,
            codigoCupom,

            status: "aguardando_pagamento",

            reserva: {
              status: "reservado",
              expiresAt,
            },
          },
        ],
        { session }
      );

      return pedido;
    });
  } catch (erro) {
    // CAMINHO 3:
    // Recuperar pedido criado por outra requisição
    // após erro de índice único.
    if (erro?.code === 11000) {
      const existente = await Order.findOne(
        filtroIdempotencia
      );

      if (existente) {
        validarIdempotenciaCheckout(
          existente,
          enderecoId,
          fingerprint
        );

        return existente;
      }
    }

    throw erro;
  }
}

module.exports = {
  executarTransacao,
  reservarEstoque,
  reservarCupom,
  consumirCupom,
  liberarCupom,
  criarPedidoCheckout,
};
