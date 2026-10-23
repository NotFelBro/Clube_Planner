
const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    tokenHash: {
      type: String,
      required: true,
      select: false,
      immutable: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "password_reset_tokens",
    timestamps: true,
    versionKey: false,
  }
);

// Evita reutilização do mesmo hash.
passwordResetTokenSchema.index(
  { tokenHash: 1 },
  { unique: true }
);

// Remove documentos expirados automaticamente.
// A remoção pelo TTL não é instantânea.
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Facilita a consulta de solicitações do usuário.
passwordResetTokenSchema.index({
  userId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);
