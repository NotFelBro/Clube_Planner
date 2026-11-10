
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";

const fieldClass =
  "mt-2 h-11 w-full rounded-lg border border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 focus:border-sage disabled:cursor-not-allowed disabled:bg-sand";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-terracotta px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

function Panel({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      {title && (
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold">
            {title}
          </h2>

          {description && (
            <p className="mt-2 text-sm leading-6 text-muted">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}

function formatarCPF(valor) {
  const numeros = String(valor ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);

  return numeros.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  );
}

function formatarTelefone(valor) {
  const numeros = String(valor ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numeros.length === 11) {
    return numeros.replace(
      /^(\d{2})(\d{5})(\d{4})$/,
      "($1) $2-$3"
    );
  }

  if (numeros.length === 10) {
    return numeros.replace(
      /^(\d{2})(\d{4})(\d{4})$/,
      "($1) $2-$3"
    );
  }

  return String(valor ?? "");
}

function criarFormulario(usuario) {
  return {
    name: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    cpf: formatarCPF(usuario?.cpf),
    phone: formatarTelefone(usuario?.telefone),
  };
}

export default function PersonalData() {
  const {
    usuario,
    carregarPerfil,
    atualizarPerfil,
  } = useAuth();

  const [form, setForm] = useState(() =>
    criarFormulario(usuario)
  );

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    setForm(criarFormulario(usuario));
  }, [usuario]);

  useEffect(() => {
    let ativo = true;

    async function buscarDados() {
      setCarregando(true);
      setErro("");

      try {
        await carregarPerfil();
      } catch (error) {
        if (ativo) {
          setErro(
            error?.message ||
              "Não foi possível atualizar os dados da conta."
          );
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void buscarDados();

    return () => {
      ativo = false;
    };
  }, [carregarPerfil]);

  function alterarCampo(campo, valor) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

    setErro("");
    setSucesso("");
  }

  const nomeAlterado =
    form.name.trim() !== (usuario?.nome ?? "").trim();

  const telefoneAlterado =
    form.phone.replace(/\D/g, "") !==
    String(usuario?.telefone ?? "").replace(/\D/g, "");

  const possuiAlteracoes =
    nomeAlterado || telefoneAlterado;

  async function salvarAlteracoes(event) {
    event.preventDefault();

    if (salvando || carregando) {
      return;
    }

    setErro("");
    setSucesso("");

    const nome = form.name.trim();
    const telefone = form.phone.replace(/\D/g, "");

    if (nome.length < 3 || nome.length > 120) {
      setErro(
        "O nome deve conter entre 3 e 120 caracteres."
      );
      return;
    }

    if (!/^\d{10,11}$/.test(telefone)) {
      setErro(
        "Informe um telefone válido com DDD."
      );
      return;
    }

    if (!possuiAlteracoes) {
      setSucesso(
        "Nenhuma alteração foi identificada."
      );
      return;
    }

    setSalvando(true);

    try {
      const atualizado = await atualizarPerfil({
        nome,
        telefone,
      });

      setForm(criarFormulario(atualizado));

      setSucesso(
        "Dados pessoais atualizados com sucesso!"
      );
    } catch (error) {
      setErro(
        error?.message ||
          "Não foi possível salvar as alterações."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Dados pessoais"
        description="Consulte e atualize as informações vinculadas à sua conta."
      >
        {carregando && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-softsage p-3 text-sm"
          >
            Atualizando informações da conta...
          </p>
        )}

        {erro && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-[#fae7de] p-3 text-sm text-terracotta"
          >
            {erro}
          </p>
        )}

        {sucesso && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-softsage p-3 text-sm"
          >
            {sucesso}
          </p>
        )}

        <form
          onSubmit={salvarAlteracoes}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Nome completo

              <input
                type="text"
                className={fieldClass}
                value={form.name}
                onChange={(event) =>
                  alterarCampo(
                    "name",
                    event.target.value
                  )
                }
                placeholder="Seu nome"
                autoComplete="name"
                minLength={3}
                maxLength={120}
                required
                disabled={carregando || salvando}
              />
            </label>

            <label className="text-xs text-muted">
              E-mail

              <input
                type="email"
                className={fieldClass}
                value={form.email}
                placeholder="voce@email.com"
                autoComplete="email"
                disabled
              />
            </label>

            <label className="text-xs text-muted">
              CPF

              <input
                type="text"
                className={fieldClass}
                value={form.cpf}
                placeholder="000.000.000-00"
                disabled
              />
            </label>

            <label className="text-xs text-muted">
              Telefone

              <input
                type="tel"
                className={fieldClass}
                value={form.phone}
                onChange={(event) =>
                  alterarCampo(
                    "phone",
                    event.target.value
                  )
                }
                placeholder="(00) 00000-0000"
                autoComplete="tel"
                maxLength={20}
                required
                disabled={carregando || salvando}
              />
            </label>
          </div>

          <button
            type="submit"
            className={primaryButton}
            disabled={
              carregando ||
              salvando ||
              !possuiAlteracoes
            }
          >
            {salvando
              ? "Salvando..."
              : "Salvar alterações"}
          </button>

          <p className="text-xs leading-6 text-muted">
            Você pode atualizar seu nome e telefone.
            O CPF e o e-mail permanecem protegidos
            contra alterações diretas.
          </p>
        </form>
      </Panel>

      <Panel
        title="Meus cartões"
        description="Consulte os métodos de pagamento vinculados à sua conta."
      >
        <div className="rounded-xl bg-sand p-5">
          <p className="font-semibold">
            Nenhum cartão vinculado
          </p>

          <p className="mt-2 text-sm leading-6 text-muted">
            Os cartões utilizados nas compras
            aparecerão aqui somente quando o
            provedor de pagamento disponibilizar
            um método de pagamento salvo e autorizado.
          </p>

          <p className="mt-3 text-xs text-muted">
            O Clube Planner não deve armazenar
            números completos de cartões nem
            códigos de segurança.
          </p>
        </div>
      </Panel>
    </div>
  );
}
