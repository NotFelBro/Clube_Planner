import BrandLogo from "../../components/brand/BrandLogo.jsx";

import { Link, useSearchParams } from "react-router";

import { formatPrice } from "../../data/products.js";
import { useStore } from "../../components/layout/StoreContext.js";

const categoryNames = {
  planners: "Planners & agendas",
  cadernos: "Cadernos & blocos",
  canetas: "Canetas & acessórios",
};

export default function Colecoes() {
  const [searchParams] = useSearchParams();
  const { addToCart, products, categories } = useStore();
  const nomes = Array.isArray(categories) ? Object.fromEntries(categories.map(c => [c.id, c.name])) : categoryNames;

  const requestedCategory = searchParams.get("categoria");
  const category = Object.hasOwn(nomes, requestedCategory) ? requestedCategory : null;
  const categoryName =
    nomes[category] ?? "Todas as coleções";

  const filteredProducts = category
    ? products.filter(
        (product) => product.category === category
      )
    : products;

  return (
    <main className="min-h-[65vh] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <nav
          aria-label="Navegação estrutural"
          className="mb-8 text-sm text-muted"
        >
          <Link
            to="/loja"
            className="hover:text-terracotta"
          >
            Loja
          </Link>

          <span className="mx-2">/</span>

          <span className="font-semibold text-slatebrand">
            {categoryName}
          </span>
        </nav>

        <div className="rounded-2xl border border-line bg-white px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <BrandLogo className="w-44" />

              <h1 className="mt-3 font-display text-3xl font-semibold text-slatebrand">
                {categoryName}
              </h1>

              <p className="mt-3 text-sm leading-7 text-muted">
                Descubra produtos para organizar sua
                rotina com criatividade e leveza.
              </p>
            </div>

            <Link
              to="/loja"
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-line bg-sand px-5 text-sm font-semibold transition hover:bg-softsage"
            >
              Voltar para a loja
            </Link>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="product-hover flex flex-col rounded-2xl border border-line bg-white p-4"
              >
                <div
                  className="flex h-40 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: product.background,
                  }}
                >
                  <img src={product.image} alt={product.name} loading="lazy" decoding="async" className="h-full w-full rounded-xl object-contain" />
                </div>

                <h2 className="mt-5 font-semibold">
                  {product.name}
                </h2>

                <p className="mt-2 text-sm text-muted">
                  {product.description}
                </p>

                <p className="mt-4 font-display text-xl font-semibold">
                  {formatPrice(product.price)}
                </p>

                <div className="mt-auto flex gap-2 pt-5">
                  <Link
                    to={`/produto/${product.id}`}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-terracotta px-3 text-sm font-semibold text-white"
                  >
                    Saber mais
                  </Link>

                  <button
                    type="button"
                    disabled={product.stock === 0}
                    onClick={() => addToCart(product)}
                    aria-label={`Adicionar ${product.name} à sacola`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-sage text-xl text-white"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-white px-6 py-14 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-softsage text-3xl text-terracotta"
            >
              ✦
            </div>

            <h2 className="mt-6 font-display text-2xl font-semibold">
              Produtos em preparação
            </h2>

            <p className="mx-auto mt-3 max-w-[440px] text-sm leading-7 text-muted">
              Ainda não há produtos cadastrados nesta
              categoria. Explore os itens disponíveis
              na nossa loja enquanto preparamos novidades.
            </p>

            <Link
              to="/loja"
              className="mt-7 inline-flex min-h-[46px] items-center justify-center rounded-xl bg-terracotta px-6 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Explorar produtos
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
