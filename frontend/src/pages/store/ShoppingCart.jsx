
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";

import { useStore } from "../../components/layout/StoreLayout.jsx";
import { formatPrice } from "../../data/products.js";

export default function ShoppingCart() {
  const navigate = useNavigate();

  const {
    cart,
    cartCount,
    cartSubtotal,
    favorites,
    toggleFavorite,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  } = useStore();

  const items = useMemo(() => {
    const grouped = new Map();

    for (const product of cart) {
      const existing = grouped.get(product.id);

      if (existing) {
        existing.quantity += 1;
      } else {
        grouped.set(product.id, {
          product,
          quantity: 1,
        });
      }
    }

    return [...grouped.values()];
  }, [cart]);

  return (
    <main className="min-h-[70vh] bg-sand px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <nav className="mb-7 flex gap-2 text-xs text-muted">
          <Link to="/loja">Loja</Link>
          <span>/</span>
          <span>Sacola</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold">
          Minha sacola
        </h1>

        <p className="mt-2 text-sm text-muted">
          Revise os produtos antes de finalizar sua compra.
        </p>

        {items.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-line bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-softsage text-4xl text-terracotta">
              ✦
            </div>

            <h2 className="mt-6 font-display text-2xl font-semibold">
              Sua sacola está vazia
            </h2>

            <p className="mt-3 text-sm text-muted">
              Escolha seus produtos favoritos para começar.
            </p>

            <Link
              to="/loja"
              className="mt-7 inline-flex rounded-xl bg-terracotta px-7 py-3 text-sm font-semibold text-white"
            >
              Explorar produtos
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-line pb-5">
                <h2 className="font-display text-xl font-semibold">
                  Produtos selecionados
                </h2>

                <span className="rounded-full bg-softsage px-3 py-1 text-xs">
                  {cartCount} itens
                </span>
              </div>

              {items.map(({ product, quantity }) => {
                const favorite = favorites.some(
                  (item) => item.id === product.id
                );

                return (
                  <article
                    key={product.id}
                    className="flex flex-col gap-5 border-b border-line py-6 last:border-0 sm:flex-row"
                  >
                    <div
                      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor:
                          product.background || "#E8F1E8",
                      }}
                    >
                      <div
                        className="flex h-20 w-14 flex-col items-center justify-center rounded-lg text-center text-[9px] font-bold text-white"
                        style={{
                          backgroundColor:
                            product.color || "#81B29A",
                        }}
                      >
                        {product.illustration || "CLUBE"}
                        <span className="mt-1 text-[7px] font-normal">
                          {product.illustrationSubtitle}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <Link
                            to={`/produto/${product.id}`}
                            className="font-display text-lg font-semibold hover:text-terracotta"
                          >
                            {product.name}
                          </Link>

                          <p className="mt-2 text-xs text-muted">
                            {product.description}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-display text-lg font-semibold">
                            {formatPrice(product.price * quantity)}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatPrice(product.price)} por unidade
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Diminuir ${product.name}`}
                            onClick={() =>
                              updateCartQuantity(
                                product.id,
                                quantity - 1
                              )
                            }
                            className="h-9 w-9 rounded-lg border border-line hover:bg-softsage"
                          >
                            −
                          </button>

                          <output className="flex h-9 w-12 items-center justify-center rounded-lg border border-line">
                            {quantity}
                          </output>

                          <button
                            type="button"
                            aria-label={`Aumentar ${product.name}`}
                            disabled={quantity >= 99}
                            onClick={() =>
                              updateCartQuantity(
                                product.id,
                                quantity + 1
                              )
                            }
                            className="h-9 w-9 rounded-lg border border-line hover:bg-softsage disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(product)}
                            aria-pressed={favorite}
                            className={
                              favorite
                                ? "text-red-600"
                                : "hover:text-terracotta"
                            }
                          >
                            {favorite ? "♥ Favoritado" : "♡ Favoritar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(product.id)
                            }
                            className="text-muted hover:text-red-600"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="rounded-2xl border border-line bg-white p-6 lg:sticky lg:top-36">
              <h2 className="font-display text-xl font-semibold">
                Resumo da compra
              </h2>

              <div className="mt-7 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted">
                    Produtos ({cartCount})
                  </span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted">Frete</span>
                  <span>A calcular</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted">Descontos</span>
                  <span>A validar</span>
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-line pt-5 font-display text-lg font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(cartSubtotal)}</span>
              </div>

              <p className="mt-3 text-xs leading-6 text-muted">
                O total definitivo será calculado após a
                validação de frete e descontos.
              </p>

              <button
                type="button"
                onClick={() => navigate("/checkout")}
                className="mt-7 min-h-12 w-full rounded-xl bg-terracotta px-5 text-sm font-semibold text-white hover:brightness-95"
              >
                Finalizar compra
              </button>

              <Link
                to="/loja"
                className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold hover:bg-softsage"
              >
                Continuar comprando
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Deseja esvaziar a sacola?"
                    )
                  ) {
                    clearCart();
                  }
                }}
                className="mt-5 w-full text-center text-xs text-muted hover:text-red-600"
              >
                Esvaziar sacola
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
