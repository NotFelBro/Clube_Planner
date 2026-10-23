const mongoose = require('mongoose');

const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const couponSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 40, match: /^[A-Z0-9_-]+$/ },
  tipo: { type: String, required: true, enum: ['percentual', 'fixo'] },
  valor: { type: Number, required: true, min: 1, validate: { validator: (v) => Number.isSafeInteger(v) && v > 0, message: 'Valor deve ser inteiro positivo.' } },
  pedidoMinimoCentavos: { type: Number, default: 0, validate: { validator: integer, message: 'Pedido mínimo inválido.' } },
  limiteUsos: { type: Number, default: null, validate: { validator: (v) => v == null || (Number.isSafeInteger(v) && v > 0), message: 'Limite global inválido.' } },
  limiteUsosPorUsuario: { type: Number, default: null, validate: { validator: (v) => v == null || (Number.isSafeInteger(v) && v > 0), message: 'Limite por usuário inválido.' } },
  // usosRealizados é mantido por compatibilidade: representa usos definitivamente consumidos.
  usosRealizados: { type: Number, default: 0, validate: { validator: integer, message: 'Usos realizados inválidos.' } },
  usosReservados: { type: Number, default: 0, validate: { validator: integer, message: 'Usos reservados inválidos.' } },
  // Campo técnico usado para serializar transações concorrentes sobre o mesmo cupom.
  revisaoUso: { type: Number, default: 0, validate: { validator: integer, message: 'Revisão inválida.' } },
  inicioEm: { type: Date, required: true },
  expiraEm: { type: Date, required: true },
  ativo: { type: Boolean, default: true },
}, { collection: 'coupons', timestamps: true, versionKey: false });

couponSchema.path('valor').validate(function (v) {
  return this.tipo !== 'percentual' || v <= 100;
}, 'Percentual deve estar entre 1 e 100.');
couponSchema.path('expiraEm').validate(function (v) {
  return !this.inicioEm || v > this.inicioEm;
}, 'Expiração deve ser posterior ao início.');
couponSchema.pre('validate', function () {
  if (this.limiteUsos != null && this.usosRealizados + this.usosReservados > this.limiteUsos) {
    this.invalidate('limiteUsos', 'O total reservado e consumido excede o limite.');
  }
});
couponSchema.index({ codigo: 1 }, { unique: true });
couponSchema.index({ ativo: 1, inicioEm: 1, expiraEm: 1 });

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
