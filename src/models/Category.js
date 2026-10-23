
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    descricao: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "categories",
    timestamps: true,
    versionKey: false,
  }
);

// Cada categoria possui um slug exclusivo.
categorySchema.index(
  { slug: 1 },
  { unique: true }
);

// Facilita consultas de categorias ativas.
categorySchema.index({
  ativo: 1,
  nome: 1,
});

module.exports = mongoose.model(
  "Category",
  categorySchema
);
