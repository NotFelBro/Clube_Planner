const produtos = require("../../shared/sampleProducts.json");
const { AuthError } = require("./authService");

function configuracao() {
  const modo = process.env.CHECKOUT_TEST_MODE || "gratuito";
  const habilitado = process.env.NODE_ENV !== "production" && ["gratuito", "mercado_pago"].includes(modo);
  return { modo, habilitado, freteCalculadoPorCep: true, ambienteTeste: true };
}
function exigirTeste() {
  if (!configuracao().habilitado) throw new AuthError("Checkout de demonstração indisponível neste ambiente.", 403);
}
function catalogo() {
  const config = configuracao();
  return { ...config, produtos: produtos.map((p) => ({ ...p, price: config.modo === "mercado_pago" ? 1 : 0 })) };
}
function productId(id) { return `0000000000000000000001${String(id).padStart(2, "0")}`; }
function variantId(id) { return `0000000000000000000002${String(id).padStart(2, "0")}`; }
function normalizarItens(itens) {
  if (!Array.isArray(itens) || !itens.length || itens.length > produtos.length) throw new AuthError("Carrinho vazio ou inválido.");
  const vistos = new Set();
  return itens.map((item) => {
    const produto = catalogo().produtos.find((p) => p.id === item?.id);
    if (!produto || vistos.has(item.id) || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 99) throw new AuthError("Produto ou quantidade inválidos.");
    vistos.add(item.id);
    return { id: item.id, quantidade: item.quantidade };
  }).sort((a, b) => a.id - b.id);
}
module.exports = { configuracao, exigirTeste, catalogo, productId, variantId, normalizarItens };
