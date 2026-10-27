
import {
  describe,
  it,
  expect,
} from "vitest";

import discountService from "../src/services/discountService.js";

const { calcularDesconto } = discountService;

describe("Serviço de descontos", () => {
  it("calcula um desconto percentual", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: 15000,
      tipo: "percentual",
      valor: 10,
    });

    expect(desconto).toBe(1500);
  });

  it("calcula um desconto fixo", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: 15000,
      tipo: "fixo",
      valor: 2500,
    });

    expect(desconto).toBe(2500);
  });

  it("limita o desconto fixo ao subtotal", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: 1000,
      tipo: "fixo",
      valor: 2000,
    });

    expect(desconto).toBe(1000);
  });

  it("permite desconto percentual de 100%", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: 5000,
      tipo: "percentual",
      valor: 100,
    });

    expect(desconto).toBe(5000);
  });

  it("arredonda corretamente o desconto percentual", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: 105,
      tipo: "percentual",
      valor: 10,
    });

    expect(desconto).toBe(11);
  });

  it("rejeita subtotal negativo", () => {
    expect(() =>
      calcularDesconto({
        subtotalCentavos: -100,
        tipo: "percentual",
        valor: 10,
      })
    ).toThrow("Subtotal inválido.");
  });

  it("rejeita valores monetários não inteiros", () => {
    expect(() =>
      calcularDesconto({
        subtotalCentavos: 100.5,
        tipo: "fixo",
        valor: 10,
      })
    ).toThrow("Subtotal inválido.");
  });

  it("rejeita percentual superior a 100%", () => {
    expect(() =>
      calcularDesconto({
        subtotalCentavos: 10000,
        tipo: "percentual",
        valor: 101,
      })
    ).toThrow(
      "Percentual de desconto inválido."
    );
  });

  it("rejeita tipos de cupom desconhecidos", () => {
    expect(() =>
      calcularDesconto({
        subtotalCentavos: 10000,
        tipo: "desconhecido",
        valor: 10,
      })
    ).toThrow("Tipo de cupom inválido.");
  });

  it("rejeita valores de cupom não positivos", () => {
    expect(() =>
      calcularDesconto({
        subtotalCentavos: 10000,
        tipo: "fixo",
        valor: 0,
      })
    ).toThrow("Valor do cupom inválido.");
  });

  it("preserva a precisão em valores inteiros seguros", () => {
    const desconto = calcularDesconto({
      subtotalCentavos: Number.MAX_SAFE_INTEGER,
      tipo: "percentual",
      valor: 100,
    });

    expect(desconto).toBe(
      Number.MAX_SAFE_INTEGER
    );
  });
});
