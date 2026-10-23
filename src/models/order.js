const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    nomeProduto: {
      type: String,
      required: true,
    },

    sku: {
      type: String,
      required: true,
    },

    atributos: {
      type: Map,
      of: String,
      default: {},
    },

    quantidade: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantidade inválida.",
      },
    },

    precoUnitarioCentavos: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Preço unitário inválido.",
      },
    },

    subtotalCentavos: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Subtotal inválido.",
      },
    },
  },
  {
    _id: false,
  }
);

const enderecoEntregaSchema = new mongoose.Schema(
  {
    cep: { type: String, required: true },
    logradouro: { type: String, required: true },
    numero: { type: String, required: true },
    complemento: { type: String, default: "" },
    bairro: { type: String, required: true },
    cidade: { type: String, required: true },
    estado: { type: String, required: true },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    checkoutIdempotencyKey: {
      type: String,
      required: true,
      immutable: true,
    },

    itens: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (itens) =>
          Array.isArray(itens) && itens.length > 0,
        message: "O pedido precisa possuir itens.",
      },
    },

    enderecoEntrega: {
      type: enderecoEntregaSchema,
      required: true,
    },

    subtotalCentavos: {
      type: Number,
      required: true,
      min: 0,
    },

    descontoCentavos: {
      type: Number,
      default: 0,
      min: 0,
    },

    freteCentavos: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCentavos: {
      type: Number,
      required: true,
      min: 0,
    },

    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    codigoCupom: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "aguardando_pagamento",
        "pago",
        "em_preparacao",
        "enviado",
        "entregue",
        "cancelado",
      ],
      default: "aguardando_pagamento",
    },

    reserva: {
      status: {
        type: String,
        enum: ["reservado", "consumido", "liberado"],
        required: true,
        default: "reservado",
      },
      expiresAt: {
        type: Date,
        required: true,
      },
    },

    pagoEm: {
      type: Date,
      default: null,
    },

    canceladoEm: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "orders",
    timestamps: true,
    versionKey: false,
  }
);

const inteiroNaoNegativo = (valor) =>
  Number.isSafeInteger(valor) && valor >= 0;

for (const campo of [
  "subtotalCentavos",
  "descontoCentavos",
  "freteCentavos",
  "totalCentavos",
]) {
  orderSchema.path(campo).validate(
    inteiroNaoNegativo,
    `${campo} deve ser um inteiro não negativo.`
  );
}

orderSchema.pre("validate", function () {
  const valoresValidos = [
    this.subtotalCentavos,
    this.descontoCentavos,
    this.freteCentavos,
    this.totalCentavos,
  ].every(inteiroNaoNegativo);

  if (!valoresValidos) return;

  if (this.descontoCentavos > this.subtotalCentavos) {
    this.invalidate(
      "descontoCentavos",
      "Desconto superior ao subtotal."
    );
    return;
  }

  const subtotalItens = this.itens.reduce(
    (total, item) => total + item.quantidade * item.precoUnitarioCentavos,
    0
  );
  if (!Number.isSafeInteger(subtotalItens) || subtotalItens !== this.subtotalCentavos) {
    this.invalidate("subtotalCentavos", "Subtotal diferente da soma dos itens.");
  }

  if (this.reserva?.status === "reservado" && this.reserva.expiresAt <= this.createdAt && this.createdAt) {
    this.invalidate("reserva.expiresAt", "Expiração deve ser posterior à criação do pedido.");
  }

  const totalEsperado =
    this.subtotalCentavos -
    this.descontoCentavos +
    this.freteCentavos;

  if (
    !Number.isSafeInteger(totalEsperado) ||
    this.totalCentavos !== totalEsperado
  ) {
    this.invalidate(
      "totalCentavos",
      "O total do pedido está inconsistente."
    );
  }
});

// Impede duplicar o checkout de um usuário.
orderSchema.index(
  { userId: 1, checkoutIdempotencyKey: 1 },
  { unique: true }
);

// Histórico de pedidos.
orderSchema.index({
  userId: 1,
  createdAt: -1,
});

// Localização de reservas vencidas.
orderSchema.index({
  "reserva.status": 1,
  "reserva.expiresAt": 1,
});

module.exports = mongoose.model(
  "Order",
  orderSchema
);
