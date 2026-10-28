
const mongoose = require('mongoose');
const { Schema } = mongoose;

const cents = v => Number.isSafeInteger(v) && v >= 0;
const positive = v => Number.isSafeInteger(v) && v > 0;

const refundItemSchema = new Schema({
  lineId: {
    type: String,
    required: true,
    match: /^[a-zA-Z0-9_-]{1,64}$/
  },
  quantidade: {
    type: Number,
    required: true,
    validate: positive
  },
  valorCentavos: {
    type: Number,
    required: true,
    validate: positive
  }
}, { _id: false });

const refundSchema = new Schema({
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    immutable: true
  },

  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    immutable: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },

  provider: {
    type: String,
    enum: ['mercado_pago'],
    default: 'mercado_pago',
    immutable: true
  },

  idempotencyKey: {
    type: String,
    required: true,
    immutable: true,
    minlength: 8,
    maxlength: 128
  },

  tipo: {
    type: String,
    required: true,
    immutable: true,
    enum: ['total', 'por_item', 'por_valor']
  },

  valorCentavos: {
    type: Number,
    required: true,
    immutable: true,
    validate: positive
  },

  freteReembolsadoCentavos: {
    type: Number,
    default: 0,
    immutable: true,
    validate: cents
  },

  itens: {
    type: [refundItemSchema],
    default: []
  },

  status: {
    type: String,
    enum: [
      'requested',
      'reserved',
      'processing',
      'succeeded',
      'failed'
    ],
    default: 'requested',
    required: true
  },

  providerRefundId: {
    type: String,
    default: null,
    trim: true
  },

  motivo: {
    type: String,
    default: null,
    maxlength: 1000
  },

  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },

  succeededAt: {
    type: Date,
    default: null
  },

  failedAt: {
    type: Date,
    default: null
  }
}, {
  collection: 'refunds',
  timestamps: true,
  versionKey: false
});

refundSchema.pre('validate', function () {
  if (this.tipo === 'por_item' && !this.itens.length) {
    this.invalidate(
      'itens',
      'Reembolso por item exige linhas.'
    );
  }

  if (this.tipo !== 'por_item' && this.itens.length) {
    this.invalidate(
      'itens',
      'Linhas permitidas apenas para reembolso por item.'
    );
  }

  if (
    this.tipo === 'por_item' &&
    this.itens.reduce(
      (s, i) => s + i.valorCentavos, 0
    ) + this.freteReembolsadoCentavos !== this.valorCentavos
  ) {
    this.invalidate(
      'valorCentavos',
      'Valor difere da soma de itens e frete.'
    );
  }

  if (
    new Set(this.itens.map(i => i.lineId)).size !==
    this.itens.length
  ) {
    this.invalidate(
      'itens',
      'Linha repetida no reembolso.'
    );
  }

  if (
    this.freteReembolsadoCentavos >
    this.valorCentavos
  ) {
    this.invalidate(
      'freteReembolsadoCentavos',
      'Frete excede reembolso.'
    );
  }

  if (this.status === 'succeeded' && !this.succeededAt) {
    this.invalidate(
      'succeededAt',
      'Sucesso exige data.'
    );
  }

  if (this.status === 'failed' && !this.failedAt) {
    this.invalidate(
      'failedAt',
      'Falha exige data.'
    );
  }
});

refundSchema.index(
  { paymentId: 1, idempotencyKey: 1 },
  { unique: true }
);

refundSchema.index(
  { provider: 1, providerRefundId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerRefundId: { $type: 'string' }
    }
  }
);

refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, status: 1 });
refundSchema.index({ status: 1, updatedAt: 1 });

module.exports =
  mongoose.models.Refund ||
  mongoose.model('Refund', refundSchema);
