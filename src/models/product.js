
const mongoose = require("mongoose");

const variacaoSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 80,
    },

    atributos: {
      type: Map,
      of: String,
      default: {},
    },

    precoCentavos: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "O preço deve ser um inteiro seguro.",
      },
    },

    estoqueDisponivel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Estoque disponível inválido.",
      },
    },

    estoqueReservado: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Estoque reservado inválido.",
      },
    },

    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

const productSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    descricao: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    categoriaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    imagens: {
      type: [String],
      default: [],
    },

    variacoes: {
      type: [variacaoSchema],
      required: true,
      validate: [
        {
          validator: (variacoes) =>
            Array.isArray(variacoes) &&
            variacoes.length > 0,
          message: "O produto deve possuir ao menos uma variação.",
        },
        
{
  validator: (variacoes) => {
    if (!Array.isArray(variacoes)) {
      return false;
    }

    const skus = [];

    for (const variacao of variacoes) {
      if (
        !variacao ||
        typeof variacao.sku !== "string"
      ) {
        return false;
      }

      const sku = variacao.sku.trim().toUpperCase();

      if (!sku) {
        return false;
      }

      skus.push(sku);
    }

    return new Set(skus).size === skus.length;
  },
  message:
    "As variações devem possuir SKUs válidos e únicos.",
},

      ],
    },

    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "products",
    timestamps: true,
    versionKey: false,
  }
);

// Identificador público do produto.
productSchema.index(
  { slug: 1 },
  { unique: true }
);

// Garante SKUs únicos entre documentos diferentes.
// A validação acima cobre duplicações dentro do produto.
productSchema.index(
  { "variacoes.sku": 1 },
  { unique: true }
);

// Consultas de catálogo.
productSchema.index({
  categoriaId: 1,
  ativo: 1,
});

// Pesquisa textual básica.
productSchema.index({
  nome: "text",
  descricao: "text",
});

module.exports = mongoose.model(
  "Product",
  productSchema
);
