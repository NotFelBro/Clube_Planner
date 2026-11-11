import { loginSlides } from "../../data/loginSlides.js";
import LoginCarousel from "../../components/auth/LoginCarousel.jsx";
import BrandLogo from "../../components/brand/BrandLogo.jsx";

import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";


import { useAuth } from "../../contexts/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const origem = location.state?.from;

  const destino =
    typeof origem?.pathname === "string" &&
    origem.pathname.startsWith("/") &&
    !origem.pathname.startsWith("//") &&
    !origem.pathname.startsWith("/\\")
      ? {
          pathname: origem.pathname,
          search:
            typeof origem.search === "string"
              ? origem.search
              : "",
          hash:
            typeof origem.hash === "string"
              ? origem.hash
              : "",
        }
      : "/perfil";

  const {
    entrar,
    autenticado,
    carregando,
  } = useAuth();

  const [identifier, setIdentifier] = useState(
    typeof location.state?.email === "string"
      ? location.state.email
      : ""
  );

  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailConfirmado =
    location.state?.emailConfirmado === true;

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || carregando) {
      return;
    }

    const identificador = identifier.trim();

    if (!identificador) {
      setNotice(
        "Informe seu e-mail cadastrado."
      );
      return;
    }

    setSubmitting(true);
    setNotice("");

    try {
      const usuario = await entrar(identificador);
      if (usuario) navigate(destino, { replace: true });
    } catch (error) {
      const mensagem =
        error?.message ||
        "Não foi possível entrar na sua conta. Tente novamente.";

      setNotice(mensagem);


    } finally {
      setSubmitting(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-5 text-slatebrand">
        <p
          role="status"
          className="text-sm text-muted"
        >
          Verificando sua sessão...
        </p>
      </main>
    );
  }

  if (autenticado) {
    return (
      <Navigate
        to={destino}
        replace
      />
    );
  }

  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[minmax(0,43.0556fr)_minmax(0,56.9444fr)]">
      <aside className="wallpaper-blue flex min-w-0 flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-16">
        <Link to="/" aria-label="Clube Planner — voltar ao login" className="inline-block w-fit max-w-full">
          <BrandLogo inverse className="w-64 sm:w-72" />
        </Link>

        <div className="mx-auto flex w-full max-w-[490px] flex-1 flex-col justify-center py-12 lg:py-8">
          <span className="mb-8 w-fit rounded-full bg-sage px-4 py-2 text-[11px] font-semibold tracking-wide text-slatebrand">
            BEM-VINDA(O) DE VOLTA
          </span>

          <h1 className="font-display text-3xl font-semibold leading-[1.45] sm:text-4xl">
            Seu próximo capítulo
            <span className="block">
              começa por aqui.
            </span>
          </h1>

          <p className="mt-8 max-w-[450px] text-[15px] leading-7">
            Entre para acompanhar seus pedidos
            e organizar suas ideias.
          </p>

          <div className="mt-8 sm:mt-12"><LoginCarousel slides={loginSlides} /></div>
        </div>

        <p className="text-sm font-medium">
          Papelaria feita pra quem organiza a vida.
        </p>
      </aside>

      <section className="flex min-w-0 items-center justify-center px-5 py-12 sm:px-10 lg:px-12">
        <div className="w-full max-w-[600px]">
          <h2 className="font-display text-[30px] font-semibold">
            Acesse sua conta
          </h2>

          <p className="mt-2 text-sm text-muted">
            Que bom ter você por aqui.
            Vamos continuar?
          </p>


          {emailConfirmado && (
            <div
              role="status"
              className="mt-6 rounded-lg border border-sage bg-[#e8f1e8] p-4 text-sm text-slatebrand"
            >
              Seu e-mail foi confirmado!
              Informe seu e-mail para acessar
              sua conta.
            </div>
          )}

          <div className="mt-12 flex gap-9 border-b border-[#e6e2d4]">
            <span className="border-b-[3px] border-terracotta pb-3 text-base font-semibold">
              Entrar
            </span>

            <Link
              to="/cadastro"
              className="pb-3 text-base font-medium text-muted transition hover:text-terracotta"
            >
              Criar conta
            </Link>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6"
          >
            <div>
              <label
                htmlFor="login-identifier"
                className="mb-2 block text-xs font-medium text-muted"
              >
                E-mail
              </label>

              <input
                id="login-identifier"
                type="email"
                autoComplete="email"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setNotice("");
                }}
                placeholder="Digite seu e-mail cadastrado"
                required
                disabled={submitting}
                className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 h-[46px] w-full rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Entrando..."
                : "Entrar na minha conta"}
            </button>

            {notice && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-[#d6a29a] bg-[#fff0ed] p-3 text-sm text-[#8f3029]"
              >
                {notice}
              </p>
            )}
          </form>

          <p className="mt-6 text-xs text-muted">
            ou continue sua visita
          </p>

          <Link
            to="/loja"
            className="mt-3 flex h-[46px] w-full items-center justify-center rounded-[11px] border border-[#b8b2a6] bg-white px-4 text-center text-sm font-semibold text-slatebrand transition hover:bg-softsage"
          >
            Continuar explorando a loja
          </Link>

          <p className="mt-8 text-[13px] text-muted">
            Ainda não tem cadastro?{" "}
            <Link
              to="/cadastro"
              className="font-semibold text-terracotta hover:underline"
            >
              Criar minha conta
            </Link>
          </p>

          <div className="mt-11 rounded-xl bg-[#e8f1e8] px-5 py-4">
            <p className="text-[13px] font-semibold text-[#2d6a4f]">
              Compra segura
            </p>

            <p className="mt-2 text-xs text-[#2b2d3f]">
              Seus dados são tratados com cuidado
              e privacidade.
            </p>
          </div>

          <p className="mt-16 text-[11px] leading-5 text-muted">
            Ao continuar, você concorda com
            os Termos de Uso e a Política de
            Privacidade.
          </p>
        </div>
      </section>
    </main>
  );
}
