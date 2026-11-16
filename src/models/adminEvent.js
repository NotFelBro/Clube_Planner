const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  acao: {
    type: String,
    required: true
  },
  entidadeId: {
    type: String,
    required: true
  },
  descricao: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true,
  versionKey: false
});
schema.index({
  entidadeId: 1,
  createdAt: -1
});
schema.index({
  createdAt: -1
});
module.exports = mongoose.models.AdminEvent || mongoose.model('AdminEvent', schema);
