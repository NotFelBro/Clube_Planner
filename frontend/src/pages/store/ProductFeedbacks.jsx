
import { useState } from "react";
import { Link, useParams } from "react-router";

import { getProductById } from "../../data/products.js";

export default function ProductFeedbacks() {
  const { id } = useParams();
  const product = getProductById(id);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  if (!product) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          Produto não encontrado
        </h1>
        <Link to="/loja" className="mt-5 inline-block text-terracotta">
          Voltar para a loja
        </Link>
      </main>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (rating === 0 || !comment.trim()) {
      setMessage("Selecione uma nota e escreva seu comentário.");
      return;
    }

    setMessage(
      "Avaliação preenchida. A publicação estará disponível após a integração com a API e a validação da compra."
    );
  }

  return (
    <main className="min-h-[70vh] bg-sand px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <nav className="mb-8 flex flex-wrap gap-2 text-xs text-muted">
          <Link to="/loja">Início</Link>
          <span>/</span>
          <Link to={`/produto/${product.id}`}>
            {product.name}
          </Link>
          <span>/</span>
          <span>Feedbacks</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold">
          Avaliações de {product.name}
        </h1>

        <p className="mt-2 text-sm text-muted">
          Confira opiniões de quem comprou e compartilhe sua experiência.
        </p>

        <section className="mt-7 rounded-2xl border border-line bg-white p-7">
          <h2 className="font-semibold">Resumo das avaliações</h2>

          <div className="mt-5 flex flex-wrap items-center gap-5">
            <span className="font-display text-4xl font-bold">
              —
            </span>

            <div>
              <p className="text-xl text-terracotta">
                ☆☆☆☆☆
              </p>
              <p className="mt-2 text-xs text-muted">
                Nenhuma avaliação publicada
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-line bg-white p-7">
            <h2 className="font-display text-xl font-semibold">
              Avaliações dos clientes
            </h2>

            <div className="mt-8 rounded-xl bg-sand p-7 text-center">
              <p className="font-semibold">
                Ainda não há avaliações
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Os comentários de compradores aparecerão aqui
                quando o sistema de avaliações estiver integrado.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-7">
            <h2 className="font-display text-xl font-semibold">
              Deixe seu feedback
            </h2>

            <p className="mt-3 text-xs text-muted">
              Publicação sujeita à validação da compra e moderação.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <fieldset>
                <legend className="text-sm font-semibold">
                  Sua nota
                </legend>

                <div className="mt-3 flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      aria-label={`${value} estrelas`}
                      aria-pressed={rating === value}
                      className={`text-3xl ${
                        value <= rating
                          ? "text-terracotta"
                          : "text-[#b8b2a6]"
                      }`}
                    >
                      {value <= rating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label
                htmlFor="product-comment"
                className="mt-6 block text-sm font-semibold"
              >
                Seu comentário
              </label>

              <textarea
                id="product-comment"
                rows={6}
                maxLength={1000}
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                placeholder="Conte como foi sua experiência com o produto..."
                className="mt-2 w-full resize-y rounded-xl border border-line bg-white p-4 text-sm outline-offset-2 focus:border-sage"
              />

              <button
                type="submit"
                className="mt-4 min-h-12 w-full rounded-xl bg-terracotta px-5 text-sm font-semibold text-white hover:brightness-95"
              >
                Enviar avaliação
              </button>

              {message && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-softsage p-3 text-sm leading-6"
                >
                  {message}
                </p>
              )}
            </form>
          </section>
        </div>

        <Link
          to={`/produto/${product.id}`}
          className="mt-7 inline-flex rounded-xl border border-line bg-white px-6 py-3 text-sm font-semibold hover:bg-softsage"
        >
          Voltar ao produto
        </Link>
      </div>
    </main>
  );
}
