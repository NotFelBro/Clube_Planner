
const mongoose = require("mongoose");

const { Schema } = mongoose;

const inteiroPositivo = (valor) =>
  Number.isSafeInteger(valor) && valor > 0;

const cartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    quantidade: {
      type: Number,
      required: true,
      validate: {
        validator: inteiroPositivo,
        message:
          "A quantidade deve ser um inteiro positivo.",
      },
    },
  },
  {
    _id: false,
  }
);

const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    itens: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: (itens) => {
          if (!Array.isArray(itens)) {
            return false;
          }

          const chaves = itens.map((item) => {
            if (!item.productId || !item.variantId) {
              return null;
            }

            return `${item.productId}:${item.variantId}`;
          });

          if (chaves.includes(null)) {
            return false;
          }

          return (
            new Set(chaves).size === chaves.length
          );
        },
        message:
          "O carrinho contém itens duplicados ou inválidos.",
      },
    },

    couponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
  },
  {
    collection: "carts",
    timestamps: true,
    versionKey: false,
  }
);

// Um carrinho persistente por usuário.
cartSchema.index(
  { userId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Cart ||
  mongoose.model("Cart", cartSchema);
