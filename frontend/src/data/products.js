import sampleProducts from "../../../shared/sampleProducts.json";

export const products = sampleProducts;

export function getProductById(id) {
  return products.find(
    (product) => product.id === Number(id)
  );
}

export function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
