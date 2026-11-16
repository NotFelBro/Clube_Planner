import useEmailRequest from "../../components/auth/useEmailRequest.js";

import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
} from "react-router";

import BrandLogo from "../../components/brand/BrandLogo.jsx";

import {
  solicitarLinkEmail,
  CadastroApiError,
} from "../../services/cadastroApi.js";

import { useAuth } from "../../contexts/AuthContext.jsx";

export default function VerificarEmail() {
  const location = useLocation();
  const envioEmail = useEmailRequest();

  const { autenticado, carregando } = useAuth();

  const emailInicial =
    typeof location.state?.email === "string"
      ? location.state.email
      : "";

  const [email, setEmail] = useState(emailInicial);
  const [reenviando, setReenviando] = useState(false);

  const [mensagem, setMensagem] = useState(
    location.state?.linkEnviado === false
      ? "Sua conta foi criada, mas o link não pôde ser enviado. Solicite um novo envio."
      : emailInicial
        ? "Enviamos um link de confirmação para seu e-mail."
        : ""
  );

  const [tipoMensagem, setTipoMensagem] =
    useState("info");

  async function handleReenviar(event) {
    event.preventDefault();

    if (reenviando) return;

    const emailNormalizado =
      email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailNormalizado
      )
    ) {
      setTipoMensagem("error");
      setMensagem("Informe um e-mail válido.");
      return;
    }

    if (!envioEmail.iniciar()) return;
    let enviado = false;
    setReenviando(true);
    setMensagem("");

    try {
      const resultado = await solicitarLinkEmail(
        emailNormalizado
      );

      enviado = true;
      setTipoMensagem("success");
      setMensagem(resultado.mensagem);
    } catch (error) {
      setTipoMensagem("error");
      setMensagem(
        error instanceof CadastroApiError
          ? error.message
          : "Não foi possível reenviar o link."
      );
    } finally {
      envioEmail.concluir(enviado);
      setReenviando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-5 text-slatebrand">
        <p role="status" className="text-sm text-muted">
          Verificando sua sessão...
        </p>
      </main>
    );
  }

  if (autenticado) {
    return <Navigate to="/loja" replace />;
  }

  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[minmax(0,38.8889fr)_minmax(0,61.1111fr)]">
      <aside className="wallpaper-blue flex min-w-0 flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-[58px]">
        <Link
          to="/"
          aria-label="Clube Planner — voltar ao login"
          className="inline-block w-fit max-w-full"
        >
          <BrandLogo inverse className="w-64 sm:w-72" />
        </Link>

        <div className="flex flex-1 flex-col justify-center py-12 lg:py-0">
          <span className="w-fit rounded-full bg-sage px-4 py-2 text-[11px] font-semibold text-slatebrand">
            SEGURANÇA DA SUA CONTA
          </span>

          <h1 className="mt-9 max-w-[430px] font-display text-[32px] font-semibold leading-[1.4] sm:text-[38px]">
            Falta só
            <span className="block">
              um pequeno passo.
            </span>
          </h1>

          <p className="mt-6 max-w-[430px] text-[15px] leading-[1.65]">
            Confirme seu endereço de e-mail para
            ativar sua conta e começar a aproveitar
            o Clube Planner.
          </p>

          <div className="mt-12 hidden max-w-[340px] rounded-[22px] bg-[#e8f1e8] p-8 text-center text-slatebrand sm:block">
            <div
              aria-hidden="true"
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl"
            >
              ✉
            </div>

            <p className="mt-5 font-display text-lg font-semibold">
              Verifique sua caixa de entrada
            </p>

            <p className="mt-2 text-sm">
              Seu link é válido por 10 minutos.
            </p>
          </div>
        </div>

        <p className="pb-3 text-[13px] font-medium">
          Clube Planner • Papelaria com afeto
        </p>
      </aside>

      <section className="flex min-w-0 items-center justify-center px-5 py-12 sm:px-10 lg:px-[60px]">
        <div className="w-full max-w-[560px]">
          <header>
            <h2 className="font-display text-[30px] font-semibold leading-tight">
              Verifique seu e-mail
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted">
              Enviamos uma mensagem com o botão
              "Verificar minha conta".
              Abra seu e-mail e siga as instruções.
            </p>
          </header>

          <div className="mt-10">
            <p className="text-[13px] font-semibold text-terracotta">
              02&nbsp; Verificação de e-mail
            </p>

            <div
              aria-hidden="true"
              className="mt-4 h-1 overflow-hidden rounded-full bg-[#e6e2d4]"
            >
              <div className="h-full w-[66%] rounded-full bg-terracotta" />
            </div>
          </div>

          <div className="mt-8 rounded-[16px] border border-line bg-white p-6">
            <p className="text-sm font-semibold">
              Acesse sua caixa de entrada
            </p>

            <p className="mt-3 text-sm leading-6 text-muted">
              Procure pelo e-mail enviado pelo
              Clube Planner. Verifique também
              a pasta de spam.
            </p>

            {emailInicial && (
              <p className="mt-4 break-all rounded-lg bg-softsage p-3 text-center text-sm font-semibold">
                {emailInicial}
              </p>
            )}

            <a
              href="https://mail.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Abrir Gmail ↗
            </a>

            <p className="mt-4 text-center text-xs leading-5 text-muted">
              Se utiliza outro provedor de e-mail,
              abra sua caixa de entrada normalmente.
            </p>
          </div>

          <form
            onSubmit={handleReenviar}
            className="mt-8"
          >
            <label
              htmlFor="verificacao-email"
              className="mb-2 block text-xs font-medium text-muted"
            >
              E-mail cadastrado
            </label>

            <input
              id="verificacao-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setMensagem("");
              }}
              placeholder="voce@email.com"
              autoComplete="email"
              required
              disabled={reenviando}
              className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 focus:border-sage disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={reenviando || envioEmail.segundos > 0}
              className="mt-4 flex h-[46px] w-full items-center justify-center rounded-[11px] border border-line bg-white px-4 text-sm font-semibold text-slatebrand transition hover:bg-softsage disabled:opacity-60"
            >
              {reenviando
                ? "Solicitando novo link..."
                : envioEmail.segundos > 0
                  ? `Reenviar em ${envioEmail.segundos}s`
                  : "Reenviar link de verificação"}
            </button>

            <p className="mt-3 text-center text-xs text-muted">
              Aguarde pelo menos 60 segundos
              entre solicitações.
            </p>
          </form>

          {mensagem && (
            <div
              role={
                tipoMensagem === "error"
                  ? "alert"
                  : "status"
              }
              className={`mt-6 rounded-lg border p-4 text-sm ${
                tipoMensagem === "error"
                  ? "border-terracotta bg-[#fae7de]"
                  : "border-sage bg-[#e8f1e8]"
              }`}
            >
              {mensagem}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              to="/"
              className="text-sm font-semibold text-terracotta hover:underline"
            >
              Voltar para o login
            </Link>
          </div>

          <p className="mt-16 text-[11px] leading-5 text-muted">
            Seus dados são protegidos e utilizados
            conforme nossa política de privacidade.
          </p>
        </div>
      </section>
    </main>
  );
}
