
import { test, expect } from "vitest";
import allocationService from "../src/services/allocationService.js";

const { alocarDesconto, valoresPorUnidade } = allocationService;

test("distribui centavos sem perdas e desempata por lineId", () => {
  const resultado = alocarDesconto(
    [
      { lineId: "b", subtotalCentavos: 100 },
      { lineId: "a", subtotalCentavos: 100 },
      { lineId: "c", subtotalCentavos: 100 },
    ],
    100
  );

  expect(
    resultado.map((item) => item.descontoAlocadoCentavos)
  ).toEqual([33, 34, 33]);

  expect(
    resultado.reduce(
      (soma, item) => soma + item.descontoAlocadoCentavos,
      0
    )
  ).toBe(100);
});

test("mantém soma por unidade", () => {
  expect(valoresPorUnidade(100, 3)).toEqual([34, 33, 33]);
});

test("rejeita lineId repetido", () => {
  expect(() =>
    alocarDesconto(
      [
        { lineId: "a", subtotalCentavos: 100 },
        { lineId: "a", subtotalCentavos: 100 },
      ],
      10
    )
  ).toThrow();
});

test("rejeita desconto maior que subtotal", () => {
  expect(() =>
    alocarDesconto(
      [{ lineId: "a", subtotalCentavos: 100 }],
      101
    )
  ).toThrow();
});

test("aceita subtotal zero com desconto zero", () => {
  const resultado = alocarDesconto(
    [{ lineId: "a", subtotalCentavos: 0 }],
    0
  );

  expect(resultado[0].totalLiquidoCentavos).toBe(0);
});
