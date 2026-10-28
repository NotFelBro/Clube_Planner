
const mongoose = require("mongoose");
const { Schema } = mongoose;

const inteiroNaoNegativo = valor =>
  Number.isSafeInteger(valor) && valor >= 0;

const inteiroPositivo = valor =>
  Number.isSafeInteger(valor) && valor > 0;

const validarCentavos = {
  validator: inteiroNaoNegativo,
  message: "O valor deve ser um inteiro não negativo."
};

const orderItemSchema = new Schema({
  lineId: {
    type: String,
    required: true,
    immutable: true,
    match: /^[a-zA-Z0-9_-]{1,64}$/
  },

  descontoAlocadoCentavos: {
    type: Number,
    required: true,
    default: 0,
    validate: validarCentavos
  },

  totalLiquidoCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  },

  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  variantId: {
    type: Schema.Types.ObjectId,
    required: true
  },

  nomeProduto: {
    type: String,
    required: true,
    trim: true
  },

  sku: {
    type: String,
    required: true,
    trim: true
  },

  atributos: {
    type: Map,
    of: String,
    default: {}
  },

  quantidade: {
    type: Number,
    required: true,
    validate: {
      validator: inteiroPositivo,
      message: "Quantidade inválida."
    }
  },

  precoUnitarioCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  },

  subtotalCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  }
}, {
  _id: false
});

orderItemSchema.pre("validate", function () {
  if (
    !inteiroPositivo(this.quantidade) ||
    !inteiroNaoNegativo(this.precoUnitarioCentavos)
  ) {
    return;
  }

  const subtotal =
    this.quantidade * this.precoUnitarioCentavos;

  if (
    Number.isSafeInteger(subtotal) &&
    (
      this.descontoAlocadoCentavos > subtotal ||
      this.totalLiquidoCentavos !==
        subtotal - this.descontoAlocadoCentavos
    )
  ) {
    this.invalidate(
      "totalLiquidoCentavos",
      "Valor líquido da linha inconsistente."
    );
  }

  if (
    !Number.isSafeInteger(subtotal) ||
    this.subtotalCentavos !== subtotal
  ) {
    this.invalidate(
      "subtotalCentavos",
      "Subtotal do item inconsistente."
    );
  }
});

const enderecoEntregaSchema = new Schema({
  cep: {
    type: String,
    required: true,
    trim: true
  },
  logradouro: {
    type: String,
    required: true,
    trim: true
  },
  numero: {
    type: String,
    required: true,
    trim: true
  },
  complemento: {
    type: String,
    default: "",
    trim: true
  },
  bairro: {
    type: String,
    required: true,
    trim: true
  },
  cidade: {
    type: String,
    required: true,
    trim: true
  },
  estado: {
    type: String,
    required: true,
    trim: true
  }
}, {
  _id: false
});

const reservaSchema = new Schema({
  status: {
    type: String,
    enum: [
      "reservado",
      "consumido",
      "liberado"
    ],
    required: true,
    default: "reservado"
  },

  expiresAt: {
    type: Date,
    required: true
  }
}, {
  _id: false
});

const couponSnapshotSchema = new Schema({
  codigo: {
    type: String,
    required: true
  },

  tipo: {
    type: String,
    required: true,
    enum: ["percentual", "fixo"]
  },

  valor: {
    type: Number,
    required: true,
    validate: validarCentavos
  },

  pedidoMinimoCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  descontoAplicadoCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  }
}, {
  _id: false
});

const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    immutable: true
  },

  checkoutIdempotencyKey: {
    type: String,
    required: true,
    immutable: true,
    trim: true,
    minlength: 8,
    maxlength: 128
  },

  checkoutRequestFingerprint: {
    type: String,
    required: false,
    immutable: true,
    match: /^[a-f0-9]{64}$/
  },

  enderecoOrigemId: {
    type: Schema.Types.ObjectId,
    required: false,
    immutable: true
  },

  itens: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: itens =>
        Array.isArray(itens) && itens.length > 0,
      message: "O pedido precisa possuir itens."
    }
  },

  enderecoEntrega: {
    type: enderecoEntregaSchema,
    required: true
  },

  subtotalCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  },

  descontoCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  freteCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  totalCentavos: {
    type: Number,
    required: true,
    validate: validarCentavos
  },

  couponSnapshot: {
    type: couponSnapshotSchema,
    default: null,
    immutable: true
  },

  couponId: {
    type: Schema.Types.ObjectId,
    ref: "Coupon",
    default: null
  },

  codigoCupom: {
    type: String,
    default: null,
    trim: true,
    uppercase: true
  },

  status: {
    type: String,
    enum: [
      "aguardando_pagamento",
      "pago",
      "em_preparacao",
      "enviado",
      "entregue",
      "cancelado"
    ],
    required: true,
    default: "aguardando_pagamento"
  },

  reserva: {
    type: reservaSchema,
    required: true
  },

  pagoEm: {
    type: Date,
    default: null
  },

  canceladoEm: {
    type: Date,
    default: null
  }
}, {
  collection: "orders",
  timestamps: true,
  versionKey: false
});

orderSchema.pre("validate", function () {
  const valores = [
    this.subtotalCentavos,
    this.descontoCentavos,
    this.freteCentavos,
    this.totalCentavos
  ];

  if (!valores.every(inteiroNaoNegativo)) {
    return;
  }

  if (this.descontoCentavos > this.subtotalCentavos) {
    this.invalidate(
      "descontoCentavos",
      "Desconto superior ao subtotal."
    );
  }

  if (Array.isArray(this.itens)) {
    const ids = this.itens.map(
      item => item.lineId
    );

    if (new Set(ids).size !== ids.length) {
      this.invalidate(
        "itens",
        "Identificador de linha duplicado."
      );
    }

    const descontoItens = this.itens.reduce(
      (s, item) =>
        s + item.descontoAlocadoCentavos,
      0
    );

    if (
      !Number.isSafeInteger(descontoItens) ||
      descontoItens !== this.descontoCentavos
    ) {
      this.invalidate(
        "descontoCentavos",
        "Rateio de desconto inconsistente."
      );
    }

    const subtotalItens = this.itens.reduce(
      (total, item) =>
        total +
        item.quantidade * item.precoUnitarioCentavos,
      0
    );

    if (
      !Number.isSafeInteger(subtotalItens) ||
      subtotalItens !== this.subtotalCentavos
    ) {
      this.invalidate(
        "subtotalCentavos",
        "Subtotal diferente da soma dos itens."
      );
    }
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
      "Total do pedido inconsistente."
    );
  }

  if (
    this.couponSnapshot &&
    (
      !this.couponId ||
      this.couponSnapshot.codigo !== this.codigoCupom ||
      this.couponSnapshot.descontoAplicadoCentavos !==
        this.descontoCentavos
    )
  ) {
    this.invalidate(
      "couponSnapshot",
      "Snapshot do cupom inconsistente."
    );
  }

  if (
    Boolean(this.couponId) !==
    Boolean(this.codigoCupom)
  ) {
    this.invalidate(
      "codigoCupom",
      "Identificação do cupom incompleta."
    );
  }

  if (this.reserva?.expiresAt) {
    const expiraEm =
      this.reserva.expiresAt.getTime();

    if (!Number.isFinite(expiraEm)) {
      this.invalidate(
        "reserva.expiresAt",
        "Data de expiração inválida."
      );
    }

    if (
      this.isNew &&
      Number.isFinite(expiraEm)
    ) {
      const referencia = this.createdAt
        ? this.createdAt.getTime()
        : Date.now();

      const diferenca =
        expiraEm - referencia;

      if (
        diferenca <= 0 ||
        diferenca > 900000
      ) {
        this.invalidate(
          "reserva.expiresAt",
          "A reserva deve expirar em até 15 minutos."
        );
      }
    }
  }

  if (
    this.status === "aguardando_pagamento" &&
    this.reserva?.status !== "reservado"
  ) {
    this.invalidate(
      "reserva.status",
      "Pedido aguardando pagamento exige reserva ativa."
    );
  }

  if (
    [
      "pago",
      "em_preparacao",
      "enviado",
      "entregue"
    ].includes(this.status)
  ) {
    if (
      this.reserva?.status !== "consumido"
    ) {
      this.invalidate(
        "reserva.status",
        "Pedido pago exige reserva consumida."
      );
    }

    if (!this.pagoEm) {
      this.invalidate(
        "pagoEm",
        "Pedido pago exige data de pagamento."
      );
    }
  }

  if (this.status === "cancelado") {
    if (!this.canceladoEm) {
      this.invalidate(
        "canceladoEm",
        "Pedido cancelado exige data de cancelamento."
      );
    }

    if (
      this.reserva?.status !== "liberado"
    ) {
      this.invalidate(
        "reserva.status",
        "Pedido cancelado exige reserva liberada."
      );
    }
  }
});

orderSchema.index(
  {
    userId: 1,
    checkoutIdempotencyKey: 1
  },
  { unique: true }
);

orderSchema.index({
  userId: 1,
  createdAt: -1
});

orderSchema.index({
  "reserva.status": 1,
  "reserva.expiresAt": 1
});

module.exports =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);
