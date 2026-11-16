const mongoose = require('mongoose');
module.exports = mongoose.models.CatalogCounter || mongoose.model('CatalogCounter', new mongoose.Schema({
  _id: String,
  sequencia: {
    type: Number,
    default: 12
  }
}, {
  versionKey: false
}));
