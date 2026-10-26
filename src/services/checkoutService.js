
const mongoose = require("mongoose");

const Product = require("../models/product");
const Coupon = require("../models/coupons");
const CouponRedemption = require("../models/couponRedemption");

/**
 * Executa operações dentro de uma transação MongoDB.
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

  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
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
          estoqueDisponivel: { $gte: quantidade },
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
    ![couponId, userId, orderId].every(
      (id) => mongoose.isObjectIdOrHexString(id)
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
    throw new Error("Reserva de cupom não encontrada.");
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
    throw new Error("Reserva de cupom não encontrada.");
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



module.exports = {
  executarTransacao,
  reservarEstoque,
  reservarCupom,
  consumirCupom,
  liberarCupom,
};

