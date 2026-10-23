
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    provider: {
      type: String,
      enum: ["mercado_pago"],
      default: "mercado_pago",
      required: true,
      immutable: true,
    },

    providerPaymentId: {
      type: String,
      default: null,
    },

    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
    },

    metodo: {
      type: String,
      enum: ["pix", "cartao", "boleto"],
      required: true,
    },

    valorCentavos: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Valor de pagamento inválido.",
      },
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
        "reembolsado",
      ],
      default: "criado",
    },

    providerStatus: {
      type: String,
      default: null,
    },

    aprovadoEm: {
      type: Date,
      default: null,
    },

    ultimaConsultaEm: {
      type: Date,
      default: null,
    },

    expiraEm: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "payments",
    timestamps: true,
    versionKey: false,
  }
);

// Uma chave única por tentativa de pagamento.
paymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true }
);

// IDs do provedor são únicos quando existentes.
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $type: "string" },
    },
  }
);

// Histórico de tentativas por pedido.
paymentSchema.index({
  orderId: 1,
  createdAt: -1,
});

// Consultas de pagamentos pendentes.
paymentSchema.index({
  status: 1,
  updatedAt: 1,
});

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);
