
import { Link, useLocation } from "react-router";

const labels = {
  "/colecoes": "Coleções",
  "/novidades": "Novidades",
  "/favoritos": "Favoritos",
  "/sacola": "Sacola de compras",
};

export default function ComingSoon() {
  const { pathname } = useLocation();

  const title = labels[pathname] ?? "Página em construção";

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-3xl font-bold">
        {title}
      </h1>

      <p className="mt-4 text-muted">
        Esta tela será implementada a partir do Figma nas próximas etapas.
      </p>

      <Link
        to="/"
        className="mt-8 inline-block rounded-xl bg-terracotta px-6 py-3 font-semibold text-white"
      >
        Voltar para a loja
      </Link>
    </section>
  );
}
