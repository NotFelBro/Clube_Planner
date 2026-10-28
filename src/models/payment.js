
const mongoose = require("mongoose");
const { Schema } = mongoose;

const validarCentavos = {
  validator: v => Number.isSafeInteger(v) && v >= 0,
  message: "Valor monetário inválido."
};

const paymentSchema = new Schema({
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    immutable: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    immutable: true
  },

  provider: {
    type: String,
    enum: ["mercado_pago"],
    default: "mercado_pago",
    required: true,
    immutable: true
  },

  providerPaymentId: {
    type: String,
    default: null,
    trim: true
  },

  idempotencyKey: {
    type: String,
    required: true,
    immutable: true,
    trim: true,
    minlength: 8,
    maxlength: 128
  },

  metodo: {
    type: String,
    enum: ["pix", "cartao", "boleto"],
    required: true,
    immutable: true
  },

  valorCentavos: {
    type: Number,
    required: true,
    immutable: true,
    validate: {
      validator: v =>
        Number.isSafeInteger(v) && v > 0,
      message: "Valor de pagamento inválido."
    }
  },

  capturedCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  refundReservedCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  refundSucceededCentavos: {
    type: Number,
    default: 0,
    validate: validarCentavos
  },

  refundUpdatedAt: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: [
      "criado",
      "pendente",
      "em_processamento",
      "aprovado",
      "recusado",
      "cancelado",
      "reembolsado"
    ],
    required: true,
    default: "criado"
  },

  providerStatus: {
    type: String,
    default: null,
    trim: true
  },

  aprovadoEm: {
    type: Date,
    default: null
  },

  ultimaConsultaEm: {
    type: Date,
    default: null
  },

  expiraEm: {
    type: Date,
    default: null
  }
}, {
  collection: "payments",
  timestamps: true,
  versionKey: false
});

paymentSchema.pre("validate", function () {
  if (
    this.capturedCentavos > this.valorCentavos ||
    this.refundReservedCentavos +
      this.refundSucceededCentavos >
      this.capturedCentavos
  ) {
    this.invalidate(
      "capturedCentavos",
      "Saldo de reembolso excede o valor capturado."
    );
  }

  if (this.status === "aprovado" && !this.aprovadoEm) {
    this.invalidate(
      "aprovadoEm",
      "Pagamento aprovado exige data de aprovação."
    );
  }

  if (
    this.aprovadoEm &&
    !["aprovado", "reembolsado"].includes(this.status)
  ) {
    this.invalidate(
      "aprovadoEm",
      "Data de aprovação incompatível com o status."
    );
  }

  if (
    this.expiraEm &&
    this.createdAt &&
    this.expiraEm <= this.createdAt
  ) {
    this.invalidate(
      "expiraEm",
      "Expiração deve ser posterior à criação."
    );
  }
});

paymentSchema.index(
  { provider: 1, idempotencyKey: 1 },
  { unique: true }
);

paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $type: "string" }
    }
  }
);

paymentSchema.index({
  orderId: 1,
  createdAt: -1
});

paymentSchema.index({
  status: 1,
  updatedAt: 1
});

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);
