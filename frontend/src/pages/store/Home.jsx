
import { Fragment, useRef, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router";

import { stationeryBrands } from "../../data/brands.js";
import HeroCarousel from "../../components/store/HeroCarousel.jsx";
import { useStore } from "../../components/layout/StoreContext.js";
import {
  formatPrice,
} from "../../data/products.js";

const categories = [
  { id: "planners", name: "Planners & agendas" },
  { id: "cadernos", name: "Cadernos & blocos" },
  { id: "canetas", name: "Canetas & acessórios" },
];

function PlannerIllustration({ compact = false }) {
  return (
    <div
      aria-hidden="true"
      className={`relative rounded-xl bg-white shadow-sm ${
        compact
          ? "h-[125px] w-[100px]"
          : "h-[180px] w-[150px]"
      }`}
    >
      <div className="absolute left-[12%] right-[12%] top-[12%] h-[6px] rounded bg-sage" />

      <div className="absolute left-[12%] top-[26%] h-1 w-[60%] rounded bg-[#e6e2d4]" />

      <div className="absolute left-[12%] top-[36%] h-1 w-[68%] rounded bg-[#e6e2d4]" />

      <div className="absolute bottom-[15%] left-[12%] right-[12%] h-[30%] rounded-md bg-[#e8f1e8]" />
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-hover flex flex-col rounded-2xl border border-line bg-white p-3">
      <div
        className="relative flex h-[165px] items-center justify-center rounded-xl"
        style={{
          backgroundColor:
            product.background || "#E8F1E8",
        }}
      >
        <PlannerIllustration compact />

      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <h3 className="text-[15px] font-semibold">
          {product.name}
        </h3>

        <p className="mt-2 text-xs text-muted">
          {product.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="font-display text-[18px] font-semibold">
            {formatPrice(product.price)}
          </span>

          {product.discount > 0 && (
            <span className="rounded-md bg-terracotta px-2 py-1 text-[10px] font-semibold text-white">
              {product.discount}% off
            </span>
          )}

          {product.coupon && (
            <span className="rounded-md bg-sage px-2 py-1 text-[10px] font-semibold text-white">
              CUPOM
            </span>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <Link
            to={`/produto/${product.id}`}
            aria-label={`Ver detalhes de ${product.name}`}
            className="flex h-[46px] flex-1 items-center justify-center rounded-[11px] bg-terracotta px-3 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Saber mais
          </Link>

          <button
            type="button"
            onClick={() => onAdd(product)}
            aria-label={`Adicionar ${product.name} à sacola`}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] bg-sage text-2xl font-semibold text-white transition hover:brightness-95"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const {
    products,
    search,
    addToCart,
  } = useStore();

  const productsRef = useRef(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const [feedback, setFeedback] =
    useState("");

  const categoryFromUrl =
    searchParams.get("categoria");

  const activeCategory = categories.some(
    (category) =>
      category.id === categoryFromUrl
  )
    ? categoryFromUrl
    : null;

  const selectedCategory = categories.find(
    (category) =>
      category.id === activeCategory
  );

  const sectionTitle = selectedCategory
    ? selectedCategory.name
    : "Produtos em destaque";

  const sectionDescription = selectedCategory
    ? `Explore os produtos de ${selectedCategory.name.toLowerCase()}.`
    : "Peças especiais para acompanhar seus melhores planos.";

  const normalizedSearch = (search ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filteredProducts = products.filter(
    (product) => {
      const matchesCategory =
        !activeCategory ||
        product.category === activeCategory;

      const matchesSearch =
        `${product.name} ${product.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);

      return (
        matchesCategory &&
        matchesSearch
      );
    }
  );

  function scrollToProducts() {
    if (!productsRef.current) return;

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    productsRef.current.scrollIntoView({
      behavior: prefersReducedMotion
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  function handleShowAll() {
    setFeedback("");

    setSearchParams({});

    window.requestAnimationFrame(
      scrollToProducts
    );
  }

  function handleAdd(product) {
    addToCart(product);

    setFeedback(
      `${product.name} adicionado à sacola.`
    );
  }

  return (
    <div>
      {/* Banner principal */}
      <section className="mx-auto max-w-[1344px] px-4 pt-8 sm:px-6">
        <HeroCarousel />
      </section>

      {/* Produtos */}
      <section
        id="produtos-destaque"
        ref={productsRef}
        className="mx-auto max-w-[1320px] scroll-mt-40 px-4 pt-14 sm:px-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[26px] font-semibold">
              {sectionTitle}
            </h2>

            <p className="mt-2 text-sm font-medium text-[#343640]">
              {sectionDescription}
            </p>
          </div>

          {activeCategory && (
            <button
              type="button"
              onClick={handleShowAll}
              className="text-sm font-semibold text-terracotta transition hover:underline"
            >
              Limpar categoria
            </button>
          )}
        </div>

        {feedback && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-sage bg-softsage px-4 py-3 text-sm"
          >
            {feedback}
          </p>
        )}

        {filteredProducts.length > 0 ? (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProducts.map((product, index) => (
              <Fragment key={product.id}>
                <ProductCard product={product} onAdd={handleAdd} />
                {(index + 1) % 4 === 0 && index < filteredProducts.length - 1 && (
                  <div className="col-span-full py-4 sm:py-6">
                    <HeroCarousel
                      compact
                      label={`Inspirações entre produtos ${Math.floor(index / 4) + 1}`}
                      initialSlide={(Math.floor(index / 4) + 1) % 3}
                      title={index < 4 ? "Dê espaço às suas ideias." : "Pequenos detalhes."}
                      subtitle={index < 4 ? "Cada página é um começo." : "Novas possibilidades."}
                      description={index < 4
                        ? "Do primeiro rascunho aos grandes planos, encontre companhia para criar."
                        : "Cores, notas e ferramentas para tornar a rotina mais criativa."}
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-xl border border-line bg-white p-8 text-center">
            <p className="font-semibold">
              Nenhum produto encontrado.
            </p>

            <p className="mt-2 text-sm text-muted">
              Tente pesquisar por outro nome ou
              selecionar outra categoria.
            </p>

            <button
              type="button"
              onClick={handleShowAll}
              className="mt-5 rounded-lg bg-terracotta px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Ver todos os produtos
            </button>
          </div>
        )}
      </section>

      <section aria-label="Marcas de papelaria" className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 sm:py-20">
        <div className="border-y border-black/50 py-8 sm:py-10">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#343640]">Marcas de papelaria</h2>
          <ul className="mx-auto mt-7 grid max-w-4xl grid-cols-2 items-center justify-items-center gap-x-6 gap-y-8 sm:gap-x-10 md:grid-cols-4">
            {stationeryBrands.map((brand) => <li key={brand.name} className="w-full min-w-0 text-center">
              <a href={brand.url} target="_blank" rel="noopener noreferrer" aria-label={`${brand.name} — site oficial (abre em nova aba)`} className="brand-hover flex h-24 w-full items-center justify-center rounded-xl px-3 py-4 sm:px-5">
                <img src={brand.logo} alt={brand.name} width="160" height="64" loading="lazy" decoding="async" className="h-16 w-full max-w-40 object-contain" />
              </a>
            </li>)}
          </ul>
        </div>
      </section>

    </div>
  );
}
