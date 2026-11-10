
import { useRef, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router";

import HeroCarousel from "../../components/store/HeroCarousel.jsx";
import { useStore } from "../../components/layout/StoreContext.js";
import {
  products,
  formatPrice,
} from "../../data/products.js";

const categories = [
  {
    id: "planners",
    name: "Planners & agendas",
    description: "Organize seus planos",
    icon: "▤",
    color: "bg-[#e8f1e8]",
  },
  {
    id: "cadernos",
    name: "Cadernos & blocos",
    description: "Ideias que ganham vida",
    icon: "▧",
    color: "bg-[#e8ebf5]",
  },
  {
    id: "papelaria",
    name: "Papelaria criativa",
    description: "Pequenos detalhes",
    icon: "✦",
    color: "bg-[#fae7de]",
  },
  {
    id: "canetas",
    name: "Canetas & acessórios",
    description: "Seu kit de criação",
    icon: "✎",
    color: "bg-[#faf1d3]",
  },
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

function CategoryCard({
  category,
  isActive,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={isActive}
      className={`flex min-h-[130px] w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${
        isActive
          ? "border-terracotta shadow-sm"
          : "border-line"
      }`}
    >
      <div
        className={`flex h-[98px] w-[76px] shrink-0 items-center justify-center rounded-xl text-[29px] ${category.color}`}
        aria-hidden="true"
      >
        {category.icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold">
          {category.name}
        </h3>

        <p className="mt-2 text-xs text-muted">
          {category.description}
        </p>

        <span className="mt-5 inline-block text-xs font-semibold text-terracotta">
          {isActive
            ? "Selecionada ✓"
            : "Explorar →"}
        </span>
      </div>
    </button>
  );
}

function ProductCard({ product, onAdd }) {
  const {
    favorites,
    toggleFavorite,
  } = useStore();

  const isFavorite = favorites.some(
    (item) => item.id === product.id
  );

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white p-3 transition hover:shadow-md">
      <div
        className="relative flex h-[165px] items-center justify-center rounded-xl"
        style={{
          backgroundColor:
            product.background || "#E8F1E8",
        }}
      >
        <PlannerIllustration compact />

        <button
          type="button"
          onClick={() =>
            toggleFavorite(product)
          }
          aria-label={
            isFavorite
              ? `Remover ${product.name} dos favoritos`
              : `Adicionar ${product.name} aos favoritos`
          }
          aria-pressed={isFavorite}
          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl shadow-sm transition hover:scale-110 ${
            isFavorite
              ? "text-red-600"
              : "text-terracotta"
          }`}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
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
    : "Favoritos da comunidade";

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
        activeCategory === "papelaria" ||
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

  function handleCategorySelect(categoryId) {
    setFeedback("");

    setSearchParams({
      categoria: categoryId,
    });

    window.requestAnimationFrame(
      scrollToProducts
    );
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
    <div className="bg-sand">
      {/* Banner principal */}
      <section className="mx-auto max-w-[1344px] px-4 pt-8 sm:px-6">
        <HeroCarousel />
      </section>

      {/* Categorias */}
      <section className="mx-auto max-w-[1320px] px-4 pt-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[26px] font-semibold">
              Compre por categoria
            </h2>

            <p className="mt-2 text-sm text-muted">
              Encontre o que combina com seu jeito
              de organizar.
            </p>
          </div>

          {activeCategory && (
            <button
              type="button"
              onClick={handleShowAll}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-terracotta transition hover:bg-softsage"
            >
              Ver todos os produtos
            </button>
          )}
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isActive={
                activeCategory === category.id
              }
              onSelect={
                handleCategorySelect
              }
            />
          ))}
        </div>
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

            <p className="mt-2 text-sm text-muted">
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
            {filteredProducts.map(
              (product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAdd}
                />
              )
            )}
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

      {/* Banner inferior */}
      <section className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 rounded-2xl bg-[#e8f1e8] px-7 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Um presente para sua rotina
            </h2>

            <p className="mt-2 text-[13px] leading-6">
              Descubra ferramentas que deixam
              o planejamento mais leve e prazeroso.
            </p>
          </div>

          <Link
            to="/colecoes?categoria=organizacao"
            className="flex min-h-[46px] shrink-0 items-center justify-center rounded-[11px] border border-line bg-white px-6 text-sm font-semibold transition hover:bg-sand"
          >
            Conhecer a papelaria
          </Link>
        </div>
      </section>
    </div>
  );
}
