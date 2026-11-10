import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import {
  confirmarCodigoEmail,
  solicitarCodigoEmail,
  CadastroApiError,
} from "../../services/cadastroApi.js";

import { useAuth } from "../../contexts/AuthContext.jsx";

export default function VerificarEmail() {
  const navigate = useNavigate();
  const location = useLocation();

  const { autenticado, carregando } = useAuth();

  const emailInicial =
    typeof location.state?.email === "string"
      ? location.state.email
      : "";

  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState(
    location.state?.codigoEnviado === false
      ? "Sua conta foi criada, mas o código não pôde ser enviado. Solicite um novo código."
      : emailInicial
        ? "Enviamos um código de verificação para seu e-mail, caso o envio tenha sido concluído."
        : ""
  );
  const [tipoMensagem, setTipoMensagem] = useState("info");

  function limparMensagem() {
    setMensagem("");
  }

  async function handleConfirmar(event) {
    event.preventDefault();

    if (enviando || reenviando || confirmado) {
      return;
    }

    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado) {
      setTipoMensagem("error");
      setMensagem("Informe seu e-mail.");
      return;
    }

    if (!/^\d{6}$/.test(codigo)) {
      setTipoMensagem("error");
      setMensagem("Informe o código de seis dígitos.");
      return;
    }

    setEnviando(true);
    limparMensagem();

    try {
      await confirmarCodigoEmail(emailNormalizado, codigo);

      setConfirmado(true);
      setCodigo("");
      setTipoMensagem("success");
      setMensagem(
        "E-mail confirmado com sucesso! Agora você pode entrar na sua conta."
      );
    } catch (error) {
      setTipoMensagem("error");
      setMensagem(
        error instanceof CadastroApiError
          ? error.message
          : "Não foi possível confirmar seu e-mail. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    if (enviando || reenviando || confirmado) {
      return;
    }

    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado) {
      setTipoMensagem("error");
      setMensagem("Informe seu e-mail para solicitar outro código.");
      return;
    }

    setReenviando(true);
    limparMensagem();

    try {
      const resultado = await solicitarCodigoEmail(
        emailNormalizado
      );

      setTipoMensagem("success");
      setMensagem(resultado.mensagem);
    } catch (error) {
      setTipoMensagem("error");
      setMensagem(
        error instanceof CadastroApiError
          ? error.message
          : "Não foi possível solicitar outro código."
      );
    } finally {
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
    return <Navigate to="/perfil" replace />;
  }

  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[38.8889%_61.1111%]">
      <aside className="flex flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-[58px]">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1 font-display text-xl font-semibold"
        >
          <span>Clube</span>
          <span className="text-terracotta">
            Planner
          </span>
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
            proteger sua conta e começar a aproveitar
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
              Seu código é válido por 10 minutos.
            </p>
          </div>
        </div>

        <p className="pb-3 text-[13px] font-medium">
          Clube Planner • Papelaria com afeto
        </p>
      </aside>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-[60px]">
        <div className="w-full max-w-[560px]">
          <header>
            <h2 className="font-display text-[30px] font-semibold leading-tight">
              Confirme seu e-mail
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted">
              Digite o código de seis dígitos enviado
              para seu endereço de e-mail.
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

          <form
            onSubmit={handleConfirmar}
            className="mt-8"
          >
            <div>
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
                  limparMensagem();
                }}
                placeholder="voce@email.com"
                autoComplete="email"
                required
                disabled={enviando || reenviando || confirmado}
                className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 focus:border-sage disabled:opacity-60"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="verificacao-codigo"
                className="mb-2 block text-xs font-medium text-muted"
              >
                Código de verificação
              </label>

              <input
                id="verificacao-codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(event) => {
                  setCodigo(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  );
                  limparMensagem();
                }}
                placeholder="000000"
                required
                disabled={enviando || reenviando || confirmado}
                className="h-[54px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-4 text-center text-2xl font-semibold tracking-[0.35em] text-slatebrand outline-offset-2 focus:border-sage disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={
                enviando ||
                reenviando ||
                confirmado ||
                codigo.length !== 6
              }
              className="mt-7 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando
                ? "Confirmando..."
                : confirmado
                  ? "E-mail confirmado"
                  : "Confirmar e-mail"}
            </button>
          </form>

          {!confirmado && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Não recebeu o código?
              </p>

              <button
                type="button"
                onClick={handleReenviar}
                disabled={enviando || reenviando}
                className="mt-2 text-sm font-semibold text-terracotta hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reenviando
                  ? "Solicitando novo código..."
                  : "Reenviar código"}
              </button>

              <p className="mt-2 text-xs text-muted">
                Aguarde pelo menos 60 segundos entre
                solicitações.
              </p>
            </div>
          )}

          {mensagem && (
            <div
              role={
                tipoMensagem === "error"
                  ? "alert"
                  : "status"
              }
              aria-live="polite"
              className={`mt-6 rounded-lg border p-4 text-sm ${
                tipoMensagem === "error"
                  ? "border-terracotta bg-[#fae7de] text-slatebrand"
                  : "border-sage bg-[#e8f1e8] text-slatebrand"
              }`}
            >
              {mensagem}
            </div>
          )}

          {confirmado && (
            <button
              type="button"
              onClick={() => {
                navigate("/", {
                  replace: true,
                  state: {
                    emailConfirmado: true,
                    email: email.trim().toLowerCase(),
                  },
                });
              }}
              className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white"
            >
              Entrar na minha conta
            </button>
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