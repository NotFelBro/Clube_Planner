
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router";

import BrandLogo from "../../components/brand/BrandLogo.jsx";

import {
  confirmarLinkEmail,
  CadastroApiError,
} from "../../services/cadastroApi.js";

import { useAuth } from "../../contexts/AuthContext.jsx";

function obterTokenDaUrl() {
  const parametros = new URLSearchParams(
    window.location.hash.slice(1)
  );

  return parametros.get("token") || "";
}

export default function ConfirmarEmail() {
  const navigate = useNavigate();
  const { renovar } = useAuth();

  // Captura o token antes de removê-lo da URL.
  const [token] = useState(obterTokenDaUrl);

  const [confirmando, setConfirmando] =
    useState(false);

  const [confirmado, setConfirmado] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    // Remove o token da barra de endereços
    // depois que o React o capturou.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname +
          window.location.search
      );
    }
  }, []);

  async function handleConfirmar() {
    if (confirmando || confirmado) {
      return;
    }

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setErro(
        "Este link é inválido ou está incompleto. Solicite outro link de verificação."
      );
      return;
    }

    setConfirmando(true);
    setErro("");
    setMensagem("");

    try {
      // Confirma o token no backend.
      // O backend ativa a conta no MongoDB
      // e tenta criar a sessão do cliente.
      const resultado =
        await confirmarLinkEmail(token);

      setConfirmado(true);

      if (resultado.sessaoCriada) {
        try {
          // Recupera a sessão criada pelo backend
          // utilizando o cookie HttpOnly.
          const accessToken = await renovar();

          if (accessToken) {
            navigate("/loja", {
              replace: true,
            });

            return;
          }
        } catch {
          // O e-mail já foi confirmado.
          // Caso a sessão não seja restaurada,
          // o usuário poderá entrar normalmente.
        }
      }

      setMensagem(
        "Seu e-mail foi confirmado com sucesso! Entre na sua conta para continuar."
      );
    } catch (error) {
      setErro(
        error instanceof CadastroApiError
          ? error.message
          : "Não foi possível confirmar seu e-mail. Tente novamente."
      );
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-5 py-12 text-slatebrand">
      <div className="w-full max-w-[520px] rounded-[24px] border border-line bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mx-auto w-fit rounded-xl bg-slatebrand p-4">
          <BrandLogo
            inverse
            className="w-56 sm:w-64"
          />
        </div>

        <div
          aria-hidden="true"
          className="mx-auto mt-9 flex h-20 w-20 items-center justify-center rounded-full bg-softsage text-4xl"
        >
          {confirmado ? "✓" : "✉"}
        </div>

        <h1 className="mt-7 font-display text-3xl font-semibold">
          {confirmado
            ? "E-mail confirmado!"
            : "Confirme sua conta"}
        </h1>

        <p className="mt-4 text-sm leading-7 text-muted">
          {confirmado
            ? "Sua conta foi ativada no Clube Planner. Agora você pode aproveitar nossa papelaria."
            : "Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta no Clube Planner."}
        </p>

        {erro && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-terracotta bg-[#fae7de] p-4 text-sm"
          >
            {erro}
          </p>
        )}

        {mensagem && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-sage bg-softsage p-4 text-sm"
          >
            {mensagem}
          </p>
        )}

        {!confirmado && (
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirmando || !token}
            className="mt-8 flex h-[48px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmando
              ? "Confirmando sua conta..."
              : "Confirmar e entrar na loja"}
          </button>
        )}

        {confirmado && (
          <Link
            to="/"
            className="mt-8 flex h-[48px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white"
          >
            Entrar na minha conta
          </Link>
        )}

        {!confirmado && (
          <Link
            to="/verificar-email"
            className="mt-6 block text-sm font-semibold text-terracotta hover:underline"
          >
            Solicitar outro link
          </Link>
        )}

        <p className="mt-10 text-xs leading-5 text-muted">
          Clube Planner • Papelaria com afeto
        </p>
      </div>
    </main>
  );
}
