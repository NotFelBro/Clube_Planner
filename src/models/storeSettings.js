const mongoose = require('mongoose');
module.exports = mongoose.models.StoreSettings || mongoose.model('StoreSettings', new mongoose.Schema({
  _id: {
    type: String,
    default: 'loja'
  },
  versao: { type: Number, default: 0, min: 0 },
  nome: {
    type: String,
    default: 'Clube Planner',
    maxlength: 100
  },
  emailAtendimento: {
    type: String,
    default: '',
    maxlength: 254
  },
  mensagemTopo: {
    type: String,
    default: 'Frete a partir de R$ 3,00 • Calculado pelo CEP de entrega',
    maxlength: 200
  },
  estoqueCritico: {
    type: Number,
    min: 0,
    max: 10000,
    default: 5
  }
}, {
  timestamps: true,
  versionKey: false
}));
