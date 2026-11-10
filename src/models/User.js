
const mongoose = require("mongoose");

function validarCPF(valor) {
  if (typeof valor !== "string") return false;

  const cpf = valor.replace(/\D/g, "");

  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (tamanho) => {
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    calcularDigito(9) === Number(cpf[9]) &&
    calcularDigito(10) === Number(cpf[10])
  );
}

const enderecoSchema = new mongoose.Schema(
  {
    cep: {
      type: String,
      required: true,
      match: /^\d{8}$/,
    },
    logradouro: {
      type: String,
      required: true,
      trim: true,
    },
    numero: {
      type: String,
      required: true,
      trim: true,
    },
    complemento: {
      type: String,
      trim: true,
      default: "",
    },
    bairro: {
      type: String,
      required: true,
      trim: true,
    },
    cidade: {
      type: String,
      required: true,
      trim: true,
    },
    estado: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z]{2}$/,
    },
    principal: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    cpf: {
      type: String,
      required: true,
      trim: true,
      set: (valor) =>
        typeof valor === "string"
          ? valor.replace(/\D/g, "")
          : valor,
      validate: {
        validator: validarCPF,
        message: "CPF inválido.",
      },
    },

    telefone: {
      type: String,
      required: true,
      trim: true,
    },

    senhaHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["client", "admin"],
      default: "client",
    },

    ativo: {
      type: Boolean,
      default: true,
    },

    // Contas antigas sem este campo serão
    // tratadas como verificadas na migração.
    emailVerificado: {
      type: Boolean,
      default: false,
    },

    emailVerificadoEm: {
      type: Date,
      default: null,
    },

    verificacaoEmail: {
      codigoHash: {
        type: String,
        select: false,
        default: null,
      },
      expiraEm: {
        type: Date,
        select: false,
        default: null,
      },
      ultimoEnvioEm: {
        type: Date,
        select: false,
        default: null,
      },
      tentativas: {
        type: Number,
        select: false,
        default: 0,
      },
    },

    enderecos: {
      type: [enderecoSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.path("enderecos").validate(
  function (enderecos) {
    if (!Array.isArray(enderecos)) return false;
    if (enderecos.length === 0) return true;

    const quantidadePrincipais = enderecos.filter(
      (endereco) => endereco.principal === true
    ).length;

    return quantidadePrincipais === 1;
  },
  "O usuário deve possuir exatamente um endereço principal quando houver endereços cadastrados."
);

userSchema.index({ cpf: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);
