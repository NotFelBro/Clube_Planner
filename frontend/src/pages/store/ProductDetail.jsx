
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import { useStore } from "../../components/layout/StoreContext.js";
import {
  formatPrice,
  getProductById,
} from "../../data/products.js";

function Heart({ filled = false }) {
  return (
    <svg
      width="20"
      height="20"
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

function ProductIllustration({ product, view = 0 }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-xl"
      style={{
        backgroundColor:
          view === 0
            ? "#FCF8F5"
            : product.background || "#E8F1E8",
      }}
    >
      <div
        className="flex aspect-[3/4] w-[45%] max-w-[190px] flex-col items-center justify-center rounded-xl shadow-md transition-transform"
        style={{
          backgroundColor: product.color || "#81B29A",
          transform: `rotate(${
            view === 1 ? -7 : view === 2 ? 7 : 0
          }deg)`,
        }}
      >
        <span className="text-center text-lg font-bold text-white">
          {product.illustration || "CLUBE"}
        </span>
        <span className="mt-2 text-center text-xs text-white">
          {product.illustrationSubtitle || "PLANNER"}
        </span>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();

  return <ProductDetailContent key={id} id={id} />;
}

function ProductDetailContent({ id }) {
  const navigate = useNavigate();
  const product = getProductById(id);

  const {
    addToCart,
    favorites,
    toggleFavorite,
  } = useStore();

  const [quantity, setQuantity] = useState(1);
  const [selectedView, setSelectedView] = useState(0);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!product) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">
          Produto não encontrado
        </h1>
        <Link
          to="/loja"
          className="mt-6 inline-block rounded-xl bg-terracotta px-6 py-3 text-white"
        >
          Voltar para a loja
        </Link>
      </main>
    );
  }

  const isFavorite = favorites.some(
    (item) => item.id === product.id
  );

  function addSelectedQuantity() {
    for (let index = 0; index < quantity; index += 1) {
      addToCart(product);
    }
  }

  function handleAddToCart() {
    addSelectedQuantity();
    setAdded(true);
    setMessage(
      `${quantity} ${
        quantity === 1
          ? "unidade adicionada"
          : "unidades adicionadas"
      } à sacola.`
    );
  }

  function handleBuyNow() {
    addSelectedQuantity();
    navigate("/checkout");
  }

  function handleFavorite() {
    toggleFavorite(product);
    setMessage(
      isFavorite
        ? "Produto removido dos favoritos."
        : "Produto adicionado aos favoritos."
    );
  }

  const actionButton =
    "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-center text-sm font-semibold transition";

  return (
    <main className="bg-sand px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label="Caminho de navegação"
            className="flex flex-wrap gap-2 text-xs text-muted"
          >
            <Link to="/loja">Início</Link>
            <span>/</span>
            <Link to="/loja">Loja</Link>
            <span>/</span>
            <span className="font-semibold text-slatebrand">
              {product.name}
            </span>
          </nav>

          <Link
            to="/loja"
            className="rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-white"
          >
            Voltar para a loja
          </Link>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-label="Imagens do produto">
            <div className="h-[340px] rounded-2xl bg-white p-6 sm:h-[460px]">
              <ProductIllustration
                product={product}
                view={selectedView}
              />
            </div>

            <div className="mt-4 flex gap-3">
              {[0, 1, 2].map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-label={`Visualização ${view + 1}`}
                  aria-pressed={selectedView === view}
                  onClick={() => setSelectedView(view)}
                  className={`h-20 w-20 overflow-hidden rounded-xl border-2 ${
                    selectedView === view
                      ? "border-terracotta"
                      : "border-transparent"
                  }`}
                >
                  <ProductIllustration
                    product={product}
                    view={view}
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
                Papelaria com afeto / {product.categoryName}
              </p>

              <button
                type="button"
                onClick={handleFavorite}
                aria-label={
                  isFavorite
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"
                }
                aria-pressed={isFavorite}
                className={`rounded-full bg-[#fae7de] p-3 ${
                  isFavorite
                    ? "text-red-600"
                    : "text-terracotta"
                }`}
              >
                <Heart filled={isFavorite} />
              </button>
            </div>

            <h1 className="mt-5 font-display text-3xl font-semibold">
              {product.name}
            </h1>

            <p className="mt-3 text-sm leading-7 text-muted">
              {product.detailDescription || product.description}
            </p>

            <Link
              to={`/produto/${product.id}/feedbacks`}
              className="mt-6 inline-flex items-center gap-2 text-xs text-muted hover:text-terracotta"
            >
              <span>☆☆☆☆☆</span>
              <span>Sem avaliações • Ver feedbacks</span>
            </Link>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="font-display text-3xl font-bold">
                {formatPrice(product.price)}
              </span>

              {product.discount > 0 && (
                <span className="rounded bg-terracotta px-2 py-1 text-xs font-bold text-white">
                  {product.discount}% off
                </span>
              )}

              {product.coupon && (
                <span className="rounded bg-sage px-2 py-1 text-xs font-bold text-white">
                  CUPOM
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-muted">
              Valor ilustrativo do catálogo.
            </p>

            <p className="mt-6 text-sm">
              Disponibilidade:{" "}
              {product.stock == null
                ? "consultar estoque"
                : product.stock > 0
                  ? `${product.stock} unidades`
                  : "indisponível"}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm font-semibold">
                Quantidade:
              </span>

              <button
                type="button"
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() =>
                  setQuantity((value) =>
                    Math.max(1, value - 1)
                  )
                }
                className="h-10 w-10 rounded-lg border border-line disabled:opacity-40"
              >
                −
              </button>

              <output className="flex h-10 w-12 items-center justify-center rounded-lg border border-line">
                {quantity}
              </output>

              <button
                type="button"
                aria-label="Aumentar quantidade"
                disabled={quantity >= 99}
                onClick={() =>
                  setQuantity((value) =>
                    Math.min(99, value + 1)
                  )
                }
                className="h-10 w-10 rounded-lg border border-line disabled:opacity-40"
              >
                +
              </button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleBuyNow}
                className={`${actionButton} border-terracotta bg-terracotta text-white hover:brightness-95`}
              >
                Comprar agora
              </button>

              <button
                type="button"
                onClick={handleAddToCart}
                className={`${actionButton} ${
                  added
                    ? "border-sage bg-softsage text-slatebrand"
                    : "border-line bg-white hover:border-sage hover:bg-softsage"
                }`}
              >
                {added
                  ? "✓ Adicionado à sacola"
                  : "Adicionar à sacola"}
              </button>

              <button
                type="button"
                onClick={handleFavorite}
                aria-pressed={isFavorite}
                className={`${actionButton} border-line bg-white hover:bg-[#fff0ef] ${
                  isFavorite ? "text-red-600" : ""
                }`}
              >
                <Heart filled={isFavorite} />
                {isFavorite ? "Favoritado" : "Favoritar"}
              </button>

              <Link
                to={`/produto/${product.id}/feedbacks`}
                className={`${actionButton} border-line bg-white hover:bg-softsage`}
              >
                ★ Feedbacks
              </Link>
            </div>

            {message && (
              <p
                role="status"
                className="mt-5 rounded-lg bg-softsage px-4 py-3 text-sm"
              >
                {message}
              </p>
            )}

            <p className="mt-5 text-xs leading-6 text-muted">
              Frete e descontos serão validados no checkout.
              O pagamento real depende da integração com o provedor.
            </p>
          </section>
        </div>

        <section className="mt-7 rounded-2xl bg-white p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">
            Descrição e especificações
          </h2>

          <p className="mt-4 text-sm leading-7 text-muted">
            Categoria: {product.categoryName} • Modelo:{" "}
            {product.model || "A confirmar"} • Material:{" "}
            {product.material || "A confirmar"}
          </p>

          <p className="mt-4 text-sm leading-7 text-muted">
            {product.detailDescription || product.description}
          </p>

          <h3 className="mt-8 font-display text-lg font-semibold">
            Feedbacks dos clientes
          </h3>

          <p className="mt-3 text-sm text-muted">
            As avaliações reais aparecerão quando estiverem disponíveis.
          </p>

          <Link
            to={`/produto/${product.id}/feedbacks`}
            className="mt-4 inline-block text-sm font-semibold text-terracotta hover:underline"
          >
            Ver avaliações e enviar feedback →
          </Link>
        </section>
      </div>
    </main>
  );
}
