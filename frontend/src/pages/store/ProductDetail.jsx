
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";

import { useStore } from "../../components/layout/StoreContext.js";
import {
  formatPrice,
} from "../../data/products.js";

function ProductIllustration({ product, view = 0 }) {
  const image = product.images?.[view];
  return <img src={image?.src || product.image} alt={image?.alt || product.name} decoding="async" className="h-full w-full rounded-xl object-contain" />;
}

export default function ProductDetail() {
  const { id } = useParams();

  return <ProductDetailContent key={id} id={id} />;
}

function ProductDetailContent({ id }) {
  const navigate = useNavigate();
  const { products } = useStore();
  const product = products.find((p) => p.id === Number(id));

  const {
    addToCart,
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
    navigate(`/checkout?produto=${product.id}&quantidade=${quantity}`);
  }

  const actionButton =
    "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-center text-sm font-semibold transition";

  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label="Caminho de navegação"
            className="flex flex-wrap items-center gap-3 text-xs text-muted"
          >
            <Link to="/loja" className="return-action">Início</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="font-semibold text-slatebrand">
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

            <div className="mt-4 flex flex-wrap gap-3">
              {(product.images || [{ src: product.image, alt: product.name }]).map((image, view) => (
                <button
                  key={view}
                  type="button"
                  aria-label={`Ver ${image.alt}`}
                  aria-pressed={selectedView === view}
                  onClick={() => setSelectedView(view)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${
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

          <section className="min-w-0 rounded-2xl bg-white p-5 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
                Papelaria com afeto / {product.categoryName}
              </p>

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
              <span>Ver avaliações de compradores</span>
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

          {product.shippingCouponLevel && <span className="rounded-md bg-softsage px-2 py-1 text-[10px] font-semibold text-slatebrand">Frete grátis · FRETE{product.shippingCouponLevel} · nível {product.shippingCouponLevel}</span>}
              {product.coupon && (
                <span className="rounded bg-sage px-2 py-1 text-xs font-bold text-white">
                  CUPOM
                </span>
              )}
            </div>

            {product.originalPrice > product.price && <p className="mt-3 text-sm text-muted">De <del>{formatPrice(product.originalPrice)}</del> · Economia de {formatPrice(product.originalPrice - product.price)}</p>}

            <p className="mt-6 text-sm">
              Disponibilidade:{" "}
              {product.stock == null
                ? "Consulte disponibilidade"
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
                disabled={quantity >= Math.min(99, product.stock ?? 99)}
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
                disabled={product.stock === 0 || quantity > product.stock}
                onClick={handleBuyNow}
                className={`${actionButton} border-terracotta bg-terracotta text-white hover:brightness-95`}
              >
                {product.stock === 0 ? "Esgotado" : "Comprar agora"}
              </button>

              <button
                type="button"
                disabled={product.stock === 0 || quantity > product.stock}
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
              Frete calculado pelo CEP de entrega no checkout.
              Confira o valor e confirme seu pedido no checkout.
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
            Consulte os comentários de compradores e avalie após confirmar seu pedido.
          </p>

          <Link
            to={`/produto/${product.id}/feedbacks`}
            className="return-action mt-4"
          >
            Ver avaliações e enviar feedback →
          </Link>
        </section>
      </div>
    </main>
  );
}
