
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { useStore } from "../../components/layout/StoreLayout.jsx";
import {
  formatPrice,
  getProductById,
} from "../../data/products.js";

const MAX_QUANTITY = 99;

function HeartIcon({ filled = false, size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  );
}

function ProductIllustration({
  product,
  view = 0,
  compact = false,
}) {
  const rotations = [
    "rotate-0",
    "-rotate-6",
    "rotate-6",
  ];

  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-xl"
      style={{
        backgroundColor:
          view === 0 ? "#FCF8F5" : product.background,
      }}
    >
      <div
        className={`flex aspect-[3/4] flex-col items-center justify-center rounded-xl shadow-sm transition-transform duration-300 ${
          compact
            ? "w-[48px]"
            : "w-[160px] sm:w-[200px]"
        } ${rotations[view]}`}
        style={{ backgroundColor: product.color }}
      >
        <span
          className={`text-center font-semibold text-white ${
            compact ? "text-[7px]" : "text-xl"
          }`}
        >
          {product.illustration}
        </span>

        <span
          className={`mt-1 text-center text-white ${
            compact ? "text-[6px]" : "text-xs"
          }`}
        >
          {product.illustrationSubtitle}
        </span>
      </div>
    </div>
  );
}

function ProductGallery({ product }) {
  const [selectedView, setSelectedView] = useState(0);

  useEffect(() => {
    setSelectedView(0);
  }, [product.id]);

  return (
    <div className="min-w-0">
      <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-2xl bg-white p-8 sm:h-[420px] lg:h-[480px]">
        <ProductIllustration
          product={product}
          view={selectedView}
        />
      </div>

      <div
        className="mt-4 flex flex-wrap gap-3"
        aria-label="Visualizações do produto"
      >
        {[0, 1, 2].map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setSelectedView(view)}
            aria-label={`Visualização ${view + 1}`}
            aria-pressed={selectedView === view}
            className={`h-[76px] w-[76px] overflow-hidden rounded-xl border-2 transition ${
              selectedView === view
                ? "border-terracotta"
                : "border-transparent hover:border-sage"
            }`}
          >
            <ProductIllustration
              product={product}
              view={view}
              compact
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function QuantitySelector({ quantity, setQuantity }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm font-medium text-slatebrand">
        Quantidade:
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setQuantity((current) =>
              Math.max(1, current - 1)
            )
          }
          disabled={quantity <= 1}
          aria-label="Diminuir quantidade"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-lg text-slatebrand transition hover:bg-softsage disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <output className="flex h-10 w-12 items-center justify-center rounded-lg border border-line bg-white text-sm font-semibold text-slatebrand">
          {quantity}
        </output>

        <button
          type="button"
          onClick={() =>
            setQuantity((current) =>
              Math.min(MAX_QUANTITY, current + 1)
            )
          }
          disabled={quantity >= MAX_QUANTITY}
          aria-label="Aumentar quantidade"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-lg text-slatebrand transition hover:bg-softsage disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ProductInformation({ product }) {
  const {
    addToCart,
    favorites,
    toggleFavorite,
  } = useStore();

  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setQuantity(1);
    setFeedback("");
  }, [product.id]);

  const isFavorite = favorites.some(
    (item) => item.id === product.id
  );

  function handleAddToCart() {
    for (let index = 0; index < quantity; index += 1) {
      addToCart(product);
    }

    setFeedback(
      `${quantity} ${
        quantity === 1
          ? "unidade adicionada"
          : "unidades adicionadas"
      } à sacola.`
    );
  }

  function handleBuyNow() {
    handleAddToCart();

    setFeedback(
      "Produto adicionado à sacola. A finalização da compra será integrada ao checkout."
    );
  }

  function handleFavorite() {
    toggleFavorite(product);

    setFeedback(
      isFavorite
        ? "Produto removido dos favoritos."
        : "Produto adicionado aos favoritos."
    );
  }

  function handleFeedbackClick() {
    const section = document.getElementById(
      "feedbacks-produto"
    );

    if (!section) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    section.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <section className="relative rounded-2xl bg-white p-6 sm:p-8">
      <button
        type="button"
        onClick={handleFavorite}
        aria-label={
          isFavorite
            ? "Remover dos favoritos"
            : "Adicionar aos favoritos"
        }
        aria-pressed={isFavorite}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#FAE7DE] text-terracotta transition hover:scale-105"
      >
        <HeartIcon filled={isFavorite} />
      </button>

      <p className="pr-12 text-[11px] font-semibold uppercase tracking-wider text-terracotta">
        PAPELARIA COM AFETO / {product.categoryName}
      </p>

      <h1 className="mt-5 pr-10 font-display text-[30px] font-semibold leading-tight text-slatebrand sm:text-[36px]">
        {product.name}
      </h1>

      <p className="mt-2 text-sm leading-6 text-muted">
        {product.detailDescription}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slatebrand">
        <span aria-label="Avaliações ainda não disponíveis">
          ☆☆☆☆☆
        </span>

        <span>Sem avaliações</span>

        <span className="text-muted">•</span>

        <button
          type="button"
          onClick={handleFeedbackClick}
          className="font-medium hover:text-terracotta hover:underline"
        >
          Ver feedbacks
        </button>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[30px] font-semibold text-slatebrand">
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

        <p className="mt-2 text-xs text-muted">
          Valor ilustrativo — substituir pelo preço
          real do catálogo.
        </p>
      </div>

      <p className="mt-6 text-sm text-slatebrand">
        Disponibilidade:{" "}
        <span className="font-medium">
          {product.stock === null
            ? "consultar estoque"
            : product.stock > 0
              ? "em estoque"
              : "indisponível"}
        </span>
      </p>

      <div className="mt-5">
        <QuantitySelector
          quantity={quantity}
          setQuantity={setQuantity}
        />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleBuyNow}
          className="min-h-[46px] rounded-xl bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Comprar agora
        </button>

        <button
          type="button"
          onClick={handleAddToCart}
          className="min-h-[46px] rounded-xl border border-line bg-white px-4 text-sm font-semibold text-slatebrand transition hover:bg-softsage"
        >
          Adicionar à sacola
        </button>

        <button
          type="button"
          onClick={handleFavorite}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-slatebrand transition hover:bg-softsage"
        >
          <HeartIcon filled={isFavorite} size={15} />
          {isFavorite ? "Favoritado" : "Favoritar"}
        </button>

        <button
          type="button"
          onClick={handleFeedbackClick}
          className="min-h-[46px] rounded-xl border border-line bg-white px-4 text-sm font-semibold text-slatebrand transition hover:bg-softsage"
        >
          ★ Feedbacks
        </button>
      </div>

      {feedback && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-softsage px-4 py-3 text-sm text-slatebrand"
        >
          {feedback}
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Entrega calculada no checkout
        <span className="mx-2">•</span>
        Compra segura
      </p>
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const product = getProductById(id);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [id]);

  if (!product) {
    return (
      <main className="min-h-[60vh] bg-sand px-4 py-16">
        <div className="mx-auto max-w-[700px] rounded-2xl bg-white p-10 text-center">
          <h1 className="font-display text-2xl font-semibold text-slatebrand">
            Produto não encontrado
          </h1>

          <p className="mt-3 text-sm text-muted">
            O produto solicitado não está disponível
            neste catálogo.
          </p>

          <Link
            to="/loja"
            className="mt-6 inline-flex rounded-xl bg-terracotta px-6 py-3 text-sm font-semibold text-white"
          >
            Voltar para a loja
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand pb-12">
      <div className="mx-auto max-w-[1320px] px-4 pt-7 sm:px-6">
        {/* Breadcrumb e retorno */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label="Caminho de navegação"
            className="flex flex-wrap items-center gap-2 text-xs text-muted"
          >
            <Link
              to="/loja"
              className="hover:text-terracotta"
            >
              Início
            </Link>

            <span>/</span>

            <Link
              to={`/loja?categoria=${product.category}`}
              className="hover:text-terracotta"
            >
              {product.categoryName}
            </Link>

            <span>/</span>

            <span
              aria-current="page"
              className="font-medium text-slatebrand"
            >
              {product.name}
            </span>
          </nav>

          <Link
            to="/loja"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta px-6 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Voltar para a loja
          </Link>
        </div>

        {/* Área principal */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <ProductGallery product={product} />

          <ProductInformation
            key={product.id}
            product={product}
          />
        </div>

        {/* Especificações */}
        <section className="mt-7 rounded-2xl bg-white px-6 py-7 sm:px-8">
          <h2 className="font-display text-xl font-semibold text-slatebrand">
            Descrição e especificações
          </h2>

          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 text-sm text-muted">
            <span>
              Categoria: {product.categoryName}
            </span>

            <span>•</span>

            <span>Modelo: {product.model}</span>

            <span>•</span>

            <span>Material: {product.material}</span>
          </div>

          <p className="mt-4 text-sm leading-7 text-muted">
            {product.detailDescription}{" "}
            Detalhes, dimensões, variações e materiais
            serão preenchidos com os dados reais do
            produto.
          </p>

          <div
            id="feedbacks-produto"
            className="mt-8 scroll-mt-40"
          >
            <h3 className="font-display text-lg font-semibold text-slatebrand">
              Feedbacks dos clientes
            </h3>

            <p className="mt-3 text-sm text-muted">
              As avaliações serão exibidas aqui quando
              estiverem disponíveis.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
