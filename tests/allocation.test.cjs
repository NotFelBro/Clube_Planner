
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  alocarDesconto,
  valoresPorUnidade
} = require('../src/services/allocationService');

test('distribui centavos sem perdas e desempata por lineId', () => {
  const resultado = alocarDesconto([
    { lineId: 'b', subtotalCentavos: 100 },
    { lineId: 'a', subtotalCentavos: 100 },
    { lineId: 'c', subtotalCentavos: 100 }
  ], 100);

  assert.deepEqual(
    resultado.map(i => i.descontoAlocadoCentavos),
    [33, 34, 33]
  );

  assert.equal(
    resultado.reduce(
      (s, i) => s + i.descontoAlocadoCentavos,
      0
    ),
    100
  );
});

test('mantém soma por unidade', () => {
  assert.deepEqual(
    valoresPorUnidade(100, 3),
    [34, 33, 33]
  );
});

test('rejeita lineId repetido', () => {
  assert.throws(() =>
    alocarDesconto([
      { lineId: 'a', subtotalCentavos: 100 },
      { lineId: 'a', subtotalCentavos: 100 }
    ], 10)
  );
});

test('rejeita desconto maior que subtotal', () => {
  assert.throws(() =>
    alocarDesconto([
      { lineId: 'a', subtotalCentavos: 100 }
    ], 101)
  );
});

test('aceita subtotal zero com desconto zero', () => {
  const resultado = alocarDesconto([
    { lineId: 'a', subtotalCentavos: 0 }
  ], 0);

  assert.equal(
    resultado[0].totalLiquidoCentavos,
    0
  );
});
