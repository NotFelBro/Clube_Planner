
'use strict';

/**
 * Rateio determinístico de descontos em centavos.
 * Usa snapshots dos itens, não preços do carrinho.
 */
function alocarDesconto(itens, descontoCentavos) {
  if (
    !Array.isArray(itens) ||
    !itens.length ||
    !Number.isSafeInteger(descontoCentavos) ||
    descontoCentavos < 0
  ) {
    throw new Error('Entrada inválida.');
  }

  const ids = new Set();

  const linhas = itens.map(item => {
    if (
      typeof item.lineId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(item.lineId) ||
      ids.has(item.lineId)
    ) {
      throw new Error('lineId inválido ou repetido.');
    }

    ids.add(item.lineId);

    if (
      !Number.isSafeInteger(item.subtotalCentavos) ||
      item.subtotalCentavos < 0
    ) {
      throw new Error('Subtotal inválido.');
    }

    return item;
  });

  const total = linhas.reduce(
    (s, i) => s + BigInt(i.subtotalCentavos),
    0n
  );

  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    BigInt(descontoCentavos) > total
  ) {
    throw new Error('Desconto excede subtotal.');
  }

  if (total === 0n) {
    return linhas.map(i => ({
      ...i,
      descontoAlocadoCentavos: 0,
      totalLiquidoCentavos: 0
    }));
  }

  const partes = linhas.map((i, index) => {
    const numerador =
      BigInt(i.subtotalCentavos) *
      BigInt(descontoCentavos);

    return {
      index,
      lineId: i.lineId,
      base: numerador / total,
      resto: numerador % total
    };
  });

  const usados = partes.reduce(
    (s, p) => s + p.base,
    0n
  );

  const faltantes = Number(
    BigInt(descontoCentavos) - usados
  );

  const ordenadas = [...partes].sort((a, b) =>
    a.resto === b.resto
      ? a.lineId.localeCompare(b.lineId, 'en')
      : a.resto > b.resto
        ? -1
        : 1
  );

  for (let k = 0; k < faltantes; k++) {
    ordenadas[k].base += 1n;
  }

  const porIndice = new Map(
    partes.map(p => [p.index, Number(p.base)])
  );

  return linhas.map((i, index) => ({
    ...i,
    descontoAlocadoCentavos: porIndice.get(index),
    totalLiquidoCentavos:
      i.subtotalCentavos - porIndice.get(index)
  }));
}

/**
 * Distribui o valor líquido entre unidades.
 * As primeiras unidades recebem os centavos restantes.
 */
function valoresPorUnidade(
  totalLiquidoCentavos,
  quantidade
) {
  if (
    !Number.isSafeInteger(totalLiquidoCentavos) ||
    totalLiquidoCentavos < 0 ||
    !Number.isSafeInteger(quantidade) ||
    quantidade <= 0 ||
    quantidade > 100000
  ) {
    throw new Error('Valores inválidos.');
  }

  const base = Math.floor(
    totalLiquidoCentavos / quantidade
  );

  const resto = totalLiquidoCentavos % quantidade;

  return Array.from(
    { length: quantidade },
    (_, i) => base + (i < resto ? 1 : 0)
  );
}

module.exports = {
  alocarDesconto,
  valoresPorUnidade
};
