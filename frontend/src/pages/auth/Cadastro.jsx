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

function PlannerIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[220px] w-[260px] rounded-[22px] bg-[#e8f1e8]"
    >
      <div className="absolute left-10 top-[25px] h-[165px] w-[115px] rounded-[10px] bg-white shadow-sm">
        <div className="absolute left-[18px] top-5 h-[6px] w-[78px] rounded bg-terracotta" />
        <div className="absolute left-[18px] top-[38px] h-1 w-[65px] rounded bg-[#e6e2d4]" />
        <div className="absolute left-[18px] top-[52px] h-1 w-[75px] rounded bg-[#e6e2d4]" />
        <div className="absolute left-[18px] top-20 h-[55px] w-[78px] rounded-md bg-[#fae7de]" />
      </div>

      <div className="absolute left-[175px] top-[45px] h-[125px] w-[52px] rounded-lg bg-terracotta shadow-sm" />
    </div>
  );
}

function FormField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  maxLength,
  inputMode,
  disabled = false,
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-medium text-muted"
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        disabled={disabled}
        required
        className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-[13px] text-sm text-slatebrand outline-offset-2 placeholder:text-muted focus:border-sage disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

function formatPhone(value) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPF(value) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function isValidCPF(value) {
  const cpf = value.replace(/\D/g, "");

  if (
    cpf.length !== 11 ||
    /^(\d)\1{10}$/.test(cpf)
  ) {
    return false;
  }

  for (let length = 9; length <= 10; length++) {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce(
        (total, digit, index) =>
          total +
          Number(digit) * (length + 1 - index),
        0
      );

    const remainder = (sum * 10) % 11;
    const expected =
      remainder === 10 ? 0 : remainder;

    if (expected !== Number(cpf[length])) {
      return false;
    }
  }

  return true;
}

const FORM_INICIAL = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  password: "",
  confirmPassword: "",
};

export default function Cadastro() {
  const navigate = useNavigate();

  const {
    autenticado,
    carregando,
  } = useAuth();

  const [form, setForm] = useState(FORM_INICIAL);

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

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

    if (
      form.phone.replace(/\D/g, "").length < 10
    ) {
      setMessage(
        "Informe um telefone válido com DDD."
      );
      return;
    }

    if (!isValidCPF(form.cpf)) {
      setMessage("Informe um CPF válido.");
      return;
    }

    if (
      form.password.length < 12 ||
      new TextEncoder().encode(
        form.password
      ).length > 72
    ) {
      setMessage(
        "A senha deve conter pelo menos 12 caracteres e no máximo 72 bytes."
      );
      return;
    }

    if (
      form.password !== form.confirmPassword
    ) {
      setMessage(
        "As senhas informadas não coincidem."
      );
      return;
    }

    if (!acceptedTerms) {
      setMessage(
        "É necessário aceitar os Termos de Uso e a Política de Privacidade."
      );
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
        telefone: form.phone.replace(/\D/g, ""),
        cpf: form.cpf.replace(/\D/g, ""),
        senha: form.password,
      });

      // A conta já foi criada no banco.
      // Não repetir o cadastro.
      setRegistered(true);

      // Remover a senha da memória do formulário.
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
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[38.8889%_61.1111%]">
      {/* Painel esquerdo */}
      <aside className="flex flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-[58px]">
        <Link
          to="/"
          aria-label="Clube Planner — voltar ao login"
          className="inline-flex w-fit items-center gap-1 font-display text-xl font-semibold"
        >
          <span className="text-sand">
            Clube
          </span>
          <span className="text-terracotta">
            Planner
          </span>
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
            Crie sua conta para salvar favoritos,
            acompanhar pedidos e deixar seus
            próximos planos ainda mais especiais.
          </p>

          <div className="mt-14 hidden sm:block lg:mt-20 lg:ml-[22px]">
            <PlannerIllustration />
          </div>
        </div>

        <p className="pb-3 text-[13px] font-medium">
          Clube Planner • Papelaria com afeto
        </p>
      </aside>

      {/* Painel direito */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-[60px]">
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

              <FormField
                id="phone"
                label="Telefone com DDD"
                type="tel"
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    formatPhone(
                      event.target.value
                    )
                  )
                }
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                disabled={
                  submitting || registered
                }
              />

              <FormField
                id="cpf"
                label="CPF"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(event) =>
                  updateField(
                    "cpf",
                    formatCPF(
                      event.target.value
                    )
                  )
                }
                inputMode="numeric"
                maxLength={14}
                disabled={
                  submitting || registered
                }
              />

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <FormField
                  id="password"
                  label="Senha"
                  type="password"
                  placeholder="Crie uma senha segura"
                  value={form.password}
                  onChange={(event) =>
                    updateField(
                      "password",
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  disabled={
                    submitting || registered
                  }
                />

                <FormField
                  id="confirmPassword"
                  label="Confirmar senha"
                  type="password"
                  placeholder="Digite novamente"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateField(
                      "confirmPassword",
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  disabled={
                    submitting || registered
                  }
                />
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(
                    event.target.checked
                  );
                  setMessage("");
                }}
                disabled={
                  submitting || registered
                }
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-terracotta"
              />

              <span>
                Li e aceito os Termos de Uso
                e a Política de Privacidade.
              </span>
            </label>

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
                  : "Criar minha conta"}
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