
import { Link, useLocation } from "react-router";

const pageTitles = {
  "/novidades": "Novidades",
  "/colecoes": "Coleções",
  "/favoritos": "Favoritos",
  "/sacola": "Sacola de compras",
  "/perfil/pedidos": "Meus pedidos",
  "/perfil/enderecos": "Meus endereços",
  "/perfil/dados": "Meus dados",
  "/perfil/cargo": "Meu cargo",
  "/perfil/seguranca": "Segurança",
  "/perfil/administrativo": "Área administrativa",
};

export default function ComingSoon() {
  const { pathname } = useLocation();

  const pageTitle =
    pageTitles[pathname] ?? "Em desenvolvimento";

  return (
    <section className="flex min-h-[65vh] items-center justify-center bg-sand px-4 py-16">
      <div className="w-full max-w-[600px] rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-sm sm:px-12">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-softsage text-3xl text-terracotta"
        >
          ✦
        </div>

        <h1 className="mt-6 font-display text-3xl font-semibold text-slatebrand">
          {pageTitle}
        </h1>

        <p className="mt-4 text-sm leading-7 text-muted">
          Estamos preparando esta área do Clube Planner
          para oferecer uma experiência ainda melhor.
        </p>

        <p className="mt-2 text-sm leading-7 text-muted">
          Em breve, você poderá aproveitar todos os
          recursos desta página.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            to="/loja"
            replace
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-terracotta px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Voltar para a loja
          </Link>
        </div>
      </div>
    </section>
  );
}
