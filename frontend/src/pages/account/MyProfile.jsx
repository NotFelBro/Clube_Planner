
import { useState } from "react";
import { Link } from "react-router";
import { useStore } from "../../components/layout/StoreLayout.jsx";

const sidebarItems = [
  { label: "Visão geral", icon: "⌂", to: "/perfil" },
  { label: "Meus pedidos", icon: "▤", to: "/perfil/pedidos" },
  { label: "Meus endereços", icon: "⌖", to: "/perfil/enderecos" },
  { label: "Favoritos", icon: "♡", to: "/favoritos" },
  { label: "Dados pessoais", icon: "♙", to: "/perfil/dados" },
  { label: "Cargo", icon: "♙", to: "/perfil/cargo" },
  { label: "Segurança", icon: "◇", to: "/perfil/seguranca" },
  {
    label: "Painel Administrativo",
    icon: "▦",
    to: "/perfil/administrativo",
  },
];

function formatCPF(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

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

function Sidebar() {
  return (
    <aside className="rounded-2xl bg-white p-5 lg:min-h-[660px]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#fae7de] text-[26px] text-terracotta">
          ♡
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Cliente Clube Planner
          </p>
          <p className="mt-1 text-xs text-muted">
            Minha área
          </p>
        </div>
      </div>

      <nav
        aria-label="Menu da minha conta"
        className="space-y-2"
      >
        {sidebarItems.map((item) => {
          const isOverview = item.to === "/perfil";

          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isOverview ? "page" : undefined}
              className={`flex min-h-[43px] items-center gap-4 rounded-[9px] px-4 text-sm transition ${
                isOverview
                  ? "bg-[#fae7de] font-semibold text-terracotta"
                  : "text-slatebrand hover:bg-softsage"
              }`}
            >
              <span
                aria-hidden="true"
                className="w-5 text-center text-lg"
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        to="/"
        className="mt-8 inline-flex rounded-lg px-4 py-3 text-sm font-semibold text-slatebrand hover:bg-softsage"
      >
        Sair da conta
      </Link>
    </aside>
  );
}

function ProfileField({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  maxLength,
}) {
  return (
    <label
      htmlFor={id}
      className="block min-w-0 text-xs font-medium text-muted"
    >
      {label}

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="mt-2 h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 placeholder:text-muted focus:border-sage"
      />
    </label>
  );
}

function PersonalData() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });

  const [message, setMessage] = useState("");

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    setMessage(
      "Os dados foram preenchidos para demonstração. A gravação estará disponível após a integração com o backend."
    );
  }

  return (
    <section
      aria-labelledby="personal-data-heading"
      className="rounded-2xl bg-white p-5 sm:p-7"
    >
      <h2
        id="personal-data-heading"
        className="font-display text-[21px] font-semibold"
      >
        Dados pessoais
      </h2>

      <p className="mt-1 text-[13px] text-muted">
        Mantenha suas informações atualizadas.
      </p>

      <form onSubmit={handleSubmit} className="mt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileField
            id="profile-name"
            label="Nome completo"
            value={form.name}
            onChange={(event) =>
              updateField("name", event.target.value)
            }
            placeholder="Seu nome"
            autoComplete="name"
          />

          <ProfileField
            id="profile-email"
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) =>
              updateField("email", event.target.value)
            }
            placeholder="voce@email.com"
            autoComplete="email"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_220px]">
          <ProfileField
            id="profile-cpf"
            label="CPF"
            value={form.cpf}
            onChange={(event) =>
              updateField("cpf", formatCPF(event.target.value))
            }
            placeholder="000.000.000-00"
            maxLength={14}
          />

          <ProfileField
            id="profile-phone"
            label="Telefone"
            value={form.phone}
            onChange={(event) =>
              updateField("phone", formatPhone(event.target.value))
            }
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            maxLength={15}
          />

          <button
            type="submit"
            className="h-[46px] self-end rounded-[11px] bg-terracotta px-5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Salvar alterações
          </button>
        </div>

        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-sage bg-softsage p-3 text-sm"
          >
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

function SummaryCard({ title, value, color, to }) {
  return (
    <article className="flex min-h-[110px] items-center gap-4 rounded-[14px] bg-white p-4">
      <div
        className={`h-[42px] w-[42px] shrink-0 rounded-[10px] ${color}`}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">
          {title}
        </p>

        <p className="mt-1 font-display text-2xl font-semibold">
          {String(value).padStart(2, "0")}
        </p>
      </div>

      <Link
        to={to}
        className="self-end rounded-[9px] bg-terracotta px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95"
      >
        Detalhes
      </Link>
    </article>
  );
}

function PurchaseSummary() {
  const { favorites } = useStore();

  return (
    <section aria-labelledby="purchase-summary-heading">
      <h2
        id="purchase-summary-heading"
        className="mb-3 font-display text-[21px] font-semibold"
      >
        Resumo das compras
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Pedidos realizados"
          value={0}
          color="bg-[#e8ebf5]"
          to="/perfil/pedidos"
        />

        <SummaryCard
          title="Em andamento"
          value={0}
          color="bg-[#faf1d3]"
          to="/perfil/pedidos"
        />

        <SummaryCard
          title="Itens favoritos"
          value={favorites.length}
          color="bg-[#fae7de]"
          to="/favoritos"
        />
      </div>
    </section>
  );
}

function RecentOrder() {
  return (
    <section
      aria-labelledby="recent-order-heading"
      className="rounded-2xl bg-white p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="recent-order-heading"
          className="text-base font-semibold"
        >
          Pedido recente
        </h2>

        <span className="rounded-full bg-[#faf1d3] px-4 py-2 text-xs font-medium">
          Nenhum pedido
        </span>
      </div>

      <p className="mt-4 text-sm text-muted">
        Seus pedidos aparecerão aqui quando o histórico estiver
        disponível.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold">
          Total R$ 0,00
        </p>

        <Link
          to="/perfil/pedidos"
          className="text-sm font-semibold text-terracotta hover:underline"
        >
          Ver pedidos →
        </Link>
      </div>
    </section>
  );
}

export default function MyProfile() {
  return (
    <div className="bg-sand">
      <div className="mx-auto max-w-[1320px] px-4 pb-7 pt-7 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-semibold">
              Minha conta
            </h1>

            <p className="mt-1 text-sm text-muted">
              Acompanhe sua conta e suas compras em um só lugar.
            </p>
          </div>

          <Link
            to="/loja"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[11px] bg-terracotta px-5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            ← Voltar para a loja
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <Sidebar />

          <div className="min-w-0 space-y-8">
            <PersonalData />
            <PurchaseSummary />
            <RecentOrder />
          </div>
        </div>
      </div>
    </div>
  );
}
