
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  calcularCheckoutFingerprint,
} = require("../src/services/checkoutFingerprint");

const enderecoId = "507f1f77bcf86cd799439011";
const produtoA = "507f1f77bcf86cd799439012";
const produtoB = "507f1f77bcf86cd799439013";
const variacaoA = "507f1f77bcf86cd799439014";
const variacaoB = "507f1f77bcf86cd799439015";
const cupomId = "507f1f77bcf86cd799439016";

function criarSolicitacao() {
  return {
    enderecoId,
    itens: [
      {
        productId: produtoA,
        variantId: variacaoA,
        quantidade: 2,
      },
      {
        productId: produtoB,
        variantId: variacaoB,
        quantidade: 1,
      },
    ],
    couponId: null,
  };
}

describe("Fingerprint de checkout", () => {
  it("gera um hash SHA-256 de 64 caracteres", () => {
    const hash = calcularCheckoutFingerprint(criarSolicitacao());

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("gera o mesmo hash para solicitações idênticas", () => {
    const primeira = calcularCheckoutFingerprint(criarSolicitacao());
    const segunda = calcularCheckoutFingerprint(criarSolicitacao());

    expect(primeira).toBe(segunda);
  });

  it("não depende da ordem dos itens", () => {
    const primeira = criarSolicitacao();
    const segunda = criarSolicitacao();

    segunda.itens.reverse();

    expect(calcularCheckoutFingerprint(primeira))
      .toBe(calcularCheckoutFingerprint(segunda));
  });

  it("detecta alteração de quantidade", () => {
    const primeira = criarSolicitacao();
    const segunda = criarSolicitacao();

    segunda.itens[0].quantidade = 3;

    expect(calcularCheckoutFingerprint(primeira))
      .not.toBe(calcularCheckoutFingerprint(segunda));
  });

  it("detecta alteração de endereço", () => {
    const primeira = criarSolicitacao();
    const segunda = criarSolicitacao();

    segunda.enderecoId = "507f1f77bcf86cd799439017";

    expect(calcularCheckoutFingerprint(primeira))
      .not.toBe(calcularCheckoutFingerprint(segunda));
  });

  it("detecta alteração de cupom", () => {
    const primeira = criarSolicitacao();
    const segunda = criarSolicitacao();

    segunda.couponId = cupomId;

    expect(calcularCheckoutFingerprint(primeira))
      .not.toBe(calcularCheckoutFingerprint(segunda));
  });

  it("rejeita itens duplicados", () => {
    const solicitacao = criarSolicitacao();

    solicitacao.itens.push({ ...solicitacao.itens[0] });

    expect(() => calcularCheckoutFingerprint(solicitacao))
      .toThrow("Itens duplicados no checkout.");
  });

  it("rejeita quantidade inválida", () => {
    const solicitacao = criarSolicitacao();

    solicitacao.itens[0].quantidade = 0;

    expect(() => calcularCheckoutFingerprint(solicitacao))
      .toThrow("Quantidade inválida.");
  });

  it("rejeita identificador inválido", () => {
    const solicitacao = criarSolicitacao();

    solicitacao.enderecoId = "endereco-invalido";

    expect(() => calcularCheckoutFingerprint(solicitacao))
      .toThrow("enderecoId inválido.");
  });

  it("rejeita carrinho vazio", () => {
    const solicitacao = criarSolicitacao();

    solicitacao.itens = [];

    expect(() => calcularCheckoutFingerprint(solicitacao))
      .toThrow("O checkout precisa possuir itens.");
  });
});
