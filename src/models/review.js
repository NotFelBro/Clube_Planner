const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productId: { type: Number, required: true },
  nome: { type: String, required: true },
  nota: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comentario: { type: String, required: true, maxlength: 1000 },
  ambienteTeste: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ userId: 1, productId: 1 }, { unique: true });
schema.index({ productId: 1, createdAt: -1 });
module.exports = mongoose.models.Review || mongoose.model("Review", schema);
