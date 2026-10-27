
const { createHash } = require("node:crypto");
const mongoose = require("mongoose");

function normalizarId(valor, campo) {
  if (!mongoose.isObjectIdOrHexString(valor)) {
    throw new Error(`${campo} inválido.`);
  }

  return String(valor).toLowerCase();
}

function normalizarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("O checkout precisa possuir itens.");
  }

  const chaves = new Set();

  const normalizados = itens.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Item do checkout inválido.");
    }

    const productId = normalizarId(item.productId, "productId");
    const variantId = normalizarId(item.variantId, "variantId");

    if (
      !Number.isSafeInteger(item.quantidade) ||
      item.quantidade <= 0
    ) {
      throw new Error("Quantidade inválida.");
    }

    const chave = `${productId}:${variantId}`;

    if (chaves.has(chave)) {
      throw new Error("Itens duplicados no checkout.");
    }

    chaves.add(chave);

    return {
      productId,
      variantId,
      quantidade: item.quantidade,
    };
  });

  return normalizados.sort((a, b) => {
    const chaveA = `${a.productId}:${a.variantId}`;
    const chaveB = `${b.productId}:${b.variantId}`;

    return chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
  });
}

function calcularCheckoutFingerprint({
  enderecoId,
  itens,
  couponId = null,
}) {
  const solicitacao = {
    versao: 1,
    enderecoId: normalizarId(enderecoId, "enderecoId"),
    itens: normalizarItens(itens),
    couponId:
      couponId === null
        ? null
        : normalizarId(couponId, "couponId"),
  };

  return createHash("sha256")
    .update(JSON.stringify(solicitacao), "utf8")
    .digest("hex");
}

module.exports = {
  calcularCheckoutFingerprint,
};
