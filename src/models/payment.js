
const mongoose = require("mongoose");

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
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
      trim: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 8,
      maxlength: 128,
    },

    metodo: {
      type: String,
      enum: ["pix", "cartao", "boleto"],
      required: true,
      immutable: true,
    },

    valorCentavos: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: (valor) =>
          Number.isSafeInteger(valor) && valor > 0,
        message:
          "Valor de pagamento deve ser um inteiro positivo.",
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
      required: true,
      default: "criado",
    },

    providerStatus: {
      type: String,
      default: null,
      trim: true,
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

// Validações de consistência documental.
paymentSchema.pre("validate", function () {
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

// Uma chave de idempotência por provedor.
paymentSchema.index(
  { provider: 1, idempotencyKey: 1 },
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

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);
