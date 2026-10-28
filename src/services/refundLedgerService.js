
'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/payment');
const Refund = require('../models/refund');
const Order = require('../models/order');

const { valoresPorUnidade } =
  require('./allocationService');

const valid = n =>
  Number.isSafeInteger(n) && n >= 0;

async function reservarReembolso({
  orderId,
  paymentId,
  userId,
  requestedBy,
  idempotencyKey,
  tipo,
  valorCentavos,
  freteReembolsadoCentavos = 0,
  itens = []
}) {
  if (
    !valid(valorCentavos) ||
    valorCentavos === 0 ||
    !valid(freteReembolsadoCentavos) ||
    freteReembolsadoCentavos > valorCentavos
  ) {
    throw new Error('Valor de reembolso inválido.');
  }

  if (
    !mongoose.isObjectIdOrHexString(paymentId) ||
    !mongoose.isObjectIdOrHexString(orderId)
  ) {
    throw new Error('IDs inválidos.');
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existente = await Refund.findOne({
        paymentId,
        idempotencyKey
      }).session(session);

      if (existente) {
        if (
          String(existente.orderId) !== String(orderId) ||
          existente.valorCentavos !== valorCentavos ||
          existente.tipo !== tipo ||
          existente.freteReembolsadoCentavos !==
            freteReembolsadoCentavos ||
          JSON.stringify(
            existente.itens.map(i => ({
              lineId: i.lineId,
              quantidade: i.quantidade,
              valorCentavos: i.valorCentavos
            }))
          ) !== JSON.stringify(itens)
        ) {
          throw new Error(
            'Chave idempotente reutilizada com conteúdo diferente.'
          );
        }

        result = existente;
        return;
      }

      const order = await Order.findOne({
        _id: orderId,
        userId
      }).session(session);

      if (!order) {
        throw new Error('Pedido não encontrado.');
      }

      const payment = await Payment.findOne({
        _id: paymentId,
        orderId,
        userId
      }).session(session);

      if (
        !payment ||
        !['aprovado', 'reembolsado'].includes(
          payment.status
        )
      ) {
        throw new Error('Pagamento não elegível.');
      }

      if (tipo === 'por_item') {
        if (
          !itens.length ||
          itens.reduce(
            (s, i) => s + i.valorCentavos,
            0
          ) + freteReembolsadoCentavos !==
            valorCentavos
        ) {
          throw new Error(
            'Itens de reembolso inconsistentes.'
          );
        }

        for (const item of itens) {
          const linha = order.itens.find(
            i => i.lineId === item.lineId
          );

          if (
            !linha ||
            !Number.isSafeInteger(item.quantidade) ||
            item.quantidade <= 0 ||
            item.quantidade > linha.quantidade
          ) {
            throw new Error(
              'Linha/quantidade inválida.'
            );
          }

          const limite = valoresPorUnidade(
            linha.totalLiquidoCentavos,
            linha.quantidade
          )
            .slice(0, item.quantidade)
            .reduce((s, v) => s + v, 0);

          if (item.valorCentavos > limite) {
            throw new Error(
              'Valor excede limite de linha.'
            );
          }
        }

        // PENDENTE:
        // Controlar cumulativamente unidades e valores
        // já reservados ou reembolsados por linha.
        //
        // Até essa implementação, impedir operações
        // por item para evitar reembolso duplicado.

        throw new Error(
          'Reembolso por item aguarda controle cumulativo por unidade.'
        );
      }

      const updated = await Payment.updateOne(
        {
          _id: paymentId,
          orderId,
          userId,
          $expr: {
            $gte: [
              {
                $subtract: [
                  '$capturedCentavos',
                  {
                    $add: [
                      '$refundReservedCentavos',
                      '$refundSucceededCentavos'
                    ]
                  }
                ]
              },
              valorCentavos
            ]
          }
        },
        {
          $inc: {
            refundReservedCentavos: valorCentavos
          },
          $set: {
            refundUpdatedAt: new Date()
          }
        },
        { session }
      );

      if (updated.modifiedCount !== 1) {
        throw new Error(
          'Saldo insuficiente ou concorrência.'
        );
      }

      const [refund] = await Refund.create(
        [{
          orderId,
          paymentId,
          userId,
          requestedBy,
          idempotencyKey,
          tipo,
          valorCentavos,
          freteReembolsadoCentavos,
          itens,
          status: 'reserved'
        }],
        { session }
      );

      result = refund;
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Aplicar somente após resultado definitivo
 * verificado no provedor.
 */
async function concluirReembolso({
  refundId,
  resultado,
  providerRefundId = null
}) {
  if (!['succeeded', 'failed'].includes(resultado)) {
    throw new Error('Resultado não definitivo.');
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const refund = await Refund.findById(
        refundId
      ).session(session);

      if (!refund) {
        throw new Error('Reembolso inexistente.');
      }

      if (
        ['succeeded', 'failed'].includes(
          refund.status
        )
      ) {
        if (refund.status !== resultado) {
          throw new Error(
            'Conflito de resultado definitivo.'
          );
        }

        result = refund;
        return;
      }

      if (
        !['reserved', 'processing'].includes(
          refund.status
        )
      ) {
        throw new Error(
          'Reembolso não reservado.'
        );
      }

      const changed = await Refund.updateOne(
        {
          _id: refundId,
          status: {
            $in: ['reserved', 'processing']
          }
        },
        {
          $set: {
            status: resultado,
            providerRefundId,
            ...(resultado === 'succeeded'
              ? { succeededAt: new Date() }
              : { failedAt: new Date() })
          }
        },
        { session }
      );

      if (changed.modifiedCount !== 1) {
        throw new Error(
          'Concorrência no reembolso.'
        );
      }

      const inc = resultado === 'succeeded'
        ? {
            refundReservedCentavos:
              -refund.valorCentavos,
            refundSucceededCentavos:
              refund.valorCentavos
          }
        : {
            refundReservedCentavos:
              -refund.valorCentavos
          };

      const payment = await Payment.updateOne(
        {
          _id: refund.paymentId,
          refundReservedCentavos: {
            $gte: refund.valorCentavos
          }
        },
        {
          $inc: inc,
          $set: {
            refundUpdatedAt: new Date()
          }
        },
        { session }
      );

      if (payment.modifiedCount !== 1) {
        throw new Error(
          'Contadores inconsistentes.'
        );
      }

      result = await Refund.findById(
        refundId
      ).session(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  reservarReembolso,
  concluirReembolso
};
