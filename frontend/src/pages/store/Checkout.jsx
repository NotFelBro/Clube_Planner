
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useStore } from "../../components/layout/StoreContext.js";
import { formatPrice } from "../../data/products.js";

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-offset-2 focus:border-sage";

function Summary({ subtotal, count }) {
  return (
    <aside className="rounded-2xl border border-line bg-white p-6">
      <h2 className="font-display text-xl font-semibold">
        Resumo da compra
      </h2>

      <div className="mt-7 space-y-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted">
            Produtos ({count})
          </span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-muted">Descontos</span>
          <span>A validar</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-muted">Frete</span>
          <span>A calcular</span>
        </div>
      </div>

      <div className="mt-6 flex justify-between border-t border-line pt-5 font-display text-lg font-semibold">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>

      <p className="mt-4 text-xs leading-6 text-muted">
        Valores demonstrativos. O total definitivo
        depende das regras de frete, descontos e estoque.
      </p>
    </aside>
  );
}

export default function Checkout() {
  const navigate = useNavigate();

  const {
    cart,
    cartCount,
    cartSubtotal,
  } = useStore();

  const [address, setAddress] = useState({
    name: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const [paymentMethod, setPaymentMethod] =
    useState("pix");

  const [message, setMessage] = useState("");

  function updateAddress(field, value) {
    setAddress((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    setMessage(
      "O checkout está pronto para integração, mas ainda não é possível confirmar ou cobrar pedidos. A próxima etapa é conectar o backend ao Mercado Pago."
    );
  }

  if (cartCount === 0) {
    return (
      <main className="min-h-[65vh] bg-sand px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">
          Sua sacola está vazia
        </h1>

        <p className="mt-4 text-sm text-muted">
          Adicione produtos antes de iniciar o checkout.
        </p>

        <Link
          to="/loja"
          className="mt-7 inline-flex rounded-xl bg-terracotta px-7 py-3 text-sm font-semibold text-white"
        >
          Explorar produtos
        </Link>
      </main>
    );
  }

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

  const items = [...grouped.values()];

  return (
    <main className="min-h-[70vh] bg-sand px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <nav className="mb-8 flex gap-2 text-xs text-muted">
          <Link to="/sacola">Sacola</Link>
          <span>/</span>
          <span>Checkout</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold">
          Finalizar compra
        </h1>

        <p className="mt-2 text-sm text-muted">
          Revise seus produtos, endereço e forma de pagamento.
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold">
                Endereço de entrega
              </h2>

              <p className="mt-2 text-xs text-muted">
                Informe o endereço para a futura validação
                do frete.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Nome do destinatário
                  <input
                    required
                    value={address.name}
                    onChange={(e) =>
                      updateAddress("name", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Nome completo"
                  />
                </label>

                <label className="text-sm">
                  CEP
                  <input
                    required
                    inputMode="numeric"
                    value={address.cep}
                    onChange={(e) =>
                      updateAddress("cep", e.target.value)
                    }
                    className={inputClass}
                    placeholder="00000-000"
                  />
                </label>

                <label className="text-sm sm:col-span-2">
                  Rua / Avenida
                  <input
                    required
                    value={address.street}
                    onChange={(e) =>
                      updateAddress("street", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Endereço"
                  />
                </label>

                <label className="text-sm">
                  Número
                  <input
                    required
                    value={address.number}
                    onChange={(e) =>
                      updateAddress("number", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Número"
                  />
                </label>

                <label className="text-sm">
                  Complemento
                  <input
                    value={address.complement}
                    onChange={(e) =>
                      updateAddress("complement", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Opcional"
                  />
                </label>

                <label className="text-sm">
                  Bairro
                  <input
                    required
                    value={address.neighborhood}
                    onChange={(e) =>
                      updateAddress("neighborhood", e.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm">
                  Cidade
                  <input
                    required
                    value={address.city}
                    onChange={(e) =>
                      updateAddress("city", e.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm">
                  Estado (UF)
                  <input
                    required
                    maxLength={2}
                    value={address.state}
                    onChange={(e) =>
                      updateAddress(
                        "state",
                        e.target.value.toUpperCase()
                      )
                    }
                    className={inputClass}
                    placeholder="SP"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold">
                Produtos do pedido
              </h2>

              <div className="mt-5 divide-y divide-line">
                {items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 py-5"
                  >
                    <div>
                      <Link
                        to={`/produto/${product.id}`}
                        className="text-sm font-semibold hover:text-terracotta"
                      >
                        {product.name}
                      </Link>

                      <p className="mt-2 text-xs text-muted">
                        {quantity}{" "}
                        {quantity === 1 ? "unidade" : "unidades"}
                      </p>
                    </div>

                    <span className="text-sm font-semibold">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold">
                Entrega e cupom de frete
              </h2>

              <div className="mt-5 rounded-xl bg-softsage p-4">
                <p className="text-sm font-semibold">
                  Entrega padrão
                </p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  O valor do frete e o prazo serão
                  calculados pela integração logística.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold">
                Forma de pagamento
              </h2>

              <p className="mt-2 text-xs text-muted">
                Selecione uma opção para preparar o checkout.
              </p>

              <fieldset className="mt-6 space-y-3">
                <legend className="sr-only">
                  Método de pagamento
                </legend>

                {[
                  {
                    id: "pix",
                    name: "Pix",
                    description: "Pagamento instantâneo",
                  },
                  {
                    id: "credit",
                    name: "Cartão de crédito",
                    description: "Condições definidas pelo provedor",
                  },
                  {
                    id: "debit",
                    name: "Cartão de débito",
                    description: "Pagamento à vista",
                  },
                ].map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                      paymentMethod === method.id
                        ? "border-sage bg-softsage"
                        : "border-line"
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold">
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={() =>
                          setPaymentMethod(method.id)
                        }
                        className="accent-[#81B29A]"
                      />
                      {method.name}
                    </span>

                    <span className="text-xs text-muted">
                      {method.description}
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>

            <button
              type="submit"
              className="min-h-12 w-full rounded-xl bg-terracotta px-5 text-sm font-semibold text-white hover:brightness-95"
            >
              Verificar disponibilidade do pagamento
            </button>

            {message && (
              <div
                role="status"
                className="rounded-xl border border-line bg-white p-5 text-sm leading-7"
              >
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/sacola")}
              className="min-h-11 rounded-xl border border-line bg-white px-6 text-sm font-semibold hover:bg-softsage"
            >
              Voltar para a sacola
            </button>
          </form>

          <Summary
            subtotal={cartSubtotal}
            count={cartCount}
          />
        </div>
      </div>
    </main>
  );
}
