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

// Servidores já iniciados podem retornar a versão anterior do catálogo sem fotos.
export function mergeCatalogImages(catalogProducts) {
  return catalogProducts.map(product => {
    const local = products.find(item => item.id === product.id);
    return {
      ...product,
      image: product.image || local?.image,
      images: product.images?.length ? product.images : local?.images,
    };
  });
}
