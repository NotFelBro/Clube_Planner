import LoginCarousel from "../../components/auth/LoginCarousel.jsx";
import { loginSlides } from "../../data/loginSlides.js";
import BrandLogo from "../../components/brand/BrandLogo.jsx";

import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
} from "react-router";

import {
  cadastrarCliente,
  CadastroApiError,
} from "../../services/cadastroApi.js";

import { useAuth } from "../../contexts/AuthContext.jsx";

function FormField({ id, label, type = "text", placeholder, value, onChange, autoComplete, disabled }) {
  return <div className="min-w-0">
    <label htmlFor={id} className="mb-2 block text-xs font-medium text-muted">{label}</label>
    <input id={id} name={id} type={type} placeholder={placeholder} value={value} onChange={onChange}
      autoComplete={autoComplete} disabled={disabled} required minLength={id === "name" ? 3 : undefined}
      maxLength={id === "name" ? 120 : 254}
      className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 placeholder:text-muted focus:border-sage disabled:opacity-60" />
  </div>;
}

const FORM_INICIAL = { name: "", email: "" };

export default function Cadastro() {
  const navigate = useNavigate();

  const {
    autenticado,
    carregando,
  } = useAuth();

  const [form, setForm] = useState(FORM_INICIAL);


  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  function updateField(field, value) {
    if (submitting || registered) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      submitting ||
      registered ||
      carregando
    ) {
      return;
    }

    if (form.name.trim().length < 3) {
      setMessage("Informe seu nome completo.");
      return;
    }

    const email = form.email
      .trim()
      .toLowerCase();

    setSubmitting(true);
    setMessage("");

    try {
      const resultado = await cadastrarCliente({
        nome: form.name.trim(),
        email,
      });

      // A conta já foi criada no banco.
      // Não repetir o cadastro.
      setRegistered(true);

      // Limpa o formulário após o cadastro.
      setForm(FORM_INICIAL);

      // O login só poderá ocorrer após a
      // confirmação do e-mail.
      navigate("/verificar-email", {
        replace: true,
        state: {
          email:
            resultado.usuario?.email || email,
          codigoEnviado: resultado.codigoEnviado,
          origem: "cadastro",
        },
      });
    } catch (error) {
      setMessage(
        error instanceof CadastroApiError
          ? error.message
          : "Não foi possível concluir o cadastro. Tente novamente."
      );
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
      <Navigate to="/perfil" replace />
    );
  }

  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[minmax(0,38.8889fr)_minmax(0,61.1111fr)]">
      {/* Painel esquerdo */}
      <aside className="wallpaper-blue flex min-w-0 flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-[58px]">
        <Link to="/" aria-label="Clube Planner — voltar ao login" className="inline-block w-fit max-w-full">
          <BrandLogo inverse className="w-64 sm:w-72" />
        </Link>

        <div className="flex flex-1 flex-col justify-center py-12 lg:py-0">
          <span className="w-fit rounded-full bg-sage px-[14px] py-2 text-[11px] font-semibold text-slatebrand">
            SEU ESPAÇO CRIATIVO
          </span>

          <h1 className="mt-9 max-w-[430px] font-display text-[32px] font-semibold leading-[1.4] sm:text-[38px]">
            Sua rotina, do
            <span className="block">
              seu jeito.
            </span>
          </h1>

          <p className="mt-6 max-w-[430px] text-[15px] leading-[1.65]">
            Crie sua conta para acompanhar pedidos
            e deixar seus
            próximos planos ainda mais especiais.
          </p>

          <div className="mt-8 sm:mt-12"><LoginCarousel slides={loginSlides} /></div>
        </div>

        <p className="pb-3 text-[13px] font-medium">
          Clube Planner • Papelaria com afeto
        </p>
      </aside>

      {/* Painel direito */}
      <section className="flex min-w-0 items-center justify-center px-5 py-12 sm:px-10 lg:px-[60px]">
        <div className="w-full max-w-[560px]">
          <header>
            <h2 className="font-display text-[30px] font-semibold leading-tight">
              Crie sua conta
            </h2>

            <p className="mt-3 text-sm text-muted">
              É rapidinho! Preencha seus dados
              para começar.
            </p>
          </header>

          <div className="mt-11">
            <p className="text-[13px] font-semibold text-terracotta">
              01&nbsp; Seus dados
            </p>

            <div
              aria-hidden="true"
              className="mt-4 h-1 overflow-hidden rounded-full bg-[#e6e2d4]"
            >
              <div className="h-full w-[32%] rounded-full bg-terracotta" />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-7"
          >
            <div className="space-y-[15px]">
              <FormField
                id="name"
                label="Nome completo"
                placeholder="Como podemos chamar você?"
                value={form.name}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value
                  )
                }
                autoComplete="name"
                disabled={
                  submitting || registered
                }
              />

              <FormField
                id="email"
                label="E-mail"
                type="email"
                placeholder="voce@email.com"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value
                  )
                }
                autoComplete="email"
                disabled={
                  submitting || registered
                }
              />






            </div>



            <button
              type="submit"
              disabled={
                submitting || registered
              }
              className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Cadastrando..."
                : registered
                  ? "Cadastro concluído"
                  : "Verificar e-mail"}
            </button>

            {message && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-4 rounded-lg border border-terracotta bg-[#fae7de] p-3 text-sm text-slatebrand"
              >
                {message}
              </div>
            )}
          </form>

          <p className="mt-6 text-xs leading-5 text-muted">
            Após criar sua conta, enviaremos
            um código de verificação para
            seu e-mail. A confirmação será
            necessária antes do primeiro acesso.
          </p>

          <div className="mt-11 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span className="text-muted">
              Já tem cadastro?
            </span>

            <Link
              to="/"
              className="font-semibold text-terracotta hover:underline"
            >
              Entrar na minha conta
            </Link>
          </div>

          <p className="mt-20 text-[11px] leading-5 text-muted">
            Seus dados são protegidos e utilizados
            conforme nossa política de privacidade.
          </p>
        </div>
      </section>
    </main>
  );
}
