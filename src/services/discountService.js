
/**
 * Calcula o desconto de um cupom.
 *
 * Todos os valores monetários são expressos
 * em centavos.
 */
function calcularDesconto({
  subtotalCentavos,
  tipo,
  valor,
}) {
  if (
    !Number.isSafeInteger(subtotalCentavos) ||
    subtotalCentavos < 0
  ) {
    throw new Error("Subtotal inválido.");
  }

  if (
    !Number.isSafeInteger(valor) ||
    valor <= 0
  ) {
    throw new Error("Valor do cupom inválido.");
  }

  let descontoCentavos;

  if (tipo === "percentual") {
    if (valor > 100) {
      throw new Error(
        "Percentual de desconto inválido."
      );
    }

    // Evita multiplicação com perda de precisão.
    const subtotal = BigInt(subtotalCentavos);
    const percentual = BigInt(valor);

    descontoCentavos = Number(
      (subtotal * percentual + 50n) / 100n
    );
  } else if (tipo === "fixo") {
    descontoCentavos = Math.min(
      valor,
      subtotalCentavos
    );
  } else {
    throw new Error("Tipo de cupom inválido.");
  }

  if (
    !Number.isSafeInteger(descontoCentavos) ||
    descontoCentavos < 0
  ) {
    throw new Error("Desconto calculado inválido.");
  }

  return Math.min(
    descontoCentavos,
    subtotalCentavos
  );
}

module.exports = {
  calcularDesconto,
};
