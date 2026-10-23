
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    quantidade: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "A quantidade deve ser inteira.",
      },
    },
  },
  {
    _id: false,
  }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    itens: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: (itens) => {
          const chaves = itens.map(
            (item) =>
              `${item.productId}:${item.variantId}`
          );

          return new Set(chaves).size === chaves.length;
        },
        message: "Existem itens duplicados no carrinho.",
      },
    },

    couponId: {
      type: mongoose.Schema.Types.ObjectId,
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

module.exports = mongoose.model(
  "Cart",
  cartSchema
);
