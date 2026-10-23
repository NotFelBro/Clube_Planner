
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },

    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokeReason: {
      type: String,
      enum: [
        "logout",
        "rotation",
        "reuse_detected",
        "password_changed",
        "session_limit",
        "admin_revocation",
        null,
      ],
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "sessions",
    timestamps: true,
    versionKey: false,
  }
);

// Impede hashes duplicados.
sessionSchema.index(
  { refreshTokenHash: 1 },
  { unique: true }
);

// Localiza sessões de um usuário.
sessionSchema.index({
  userId: 1,
  revokedAt: 1,
  expiresAt: 1,
});

// Localiza sessões da mesma família.
sessionSchema.index({
  familyId: 1,
  revokedAt: 1,
});

// Limpeza automática de sessões expiradas.
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "Session",
  sessionSchema
);
