
import AccountOrders, { OrdersSummary } from "../../components/account/AccountOrders.jsx";
import { Link, NavLink, useLocation } from "react-router";

import { useAuth } from "../../contexts/AuthContext.jsx";

import LogoutButton from "../../components/auth/LogoutButton.jsx";
import AccountSecurity from "../../components/account/AccountSecurity.jsx";
import PersonalData from "../../components/account/PersonalData.jsx";

const menuItems = [
  { label: "Visão geral", icon: "⌂", to: "/perfil" },
  { label: "Segurança", icon: "◇", to: "/perfil/seguranca" },
  { label: "Painel administrador", icon: "⚙", to: "/admin", adminOnly: true },
];

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-terracotta px-5 text-sm font-semibold text-white transition hover:brightness-95";


function Sidebar() {
  const { usuario } = useAuth();
  const itensVisiveis = menuItems.filter(item => !item.adminOnly || usuario?.role === "admin");

  return (
    <aside className="min-w-0 self-start rounded-2xl bg-white p-5 lg:sticky lg:top-36">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fae7de] text-2xl text-terracotta">
          ♙
        </div>

        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">
            {usuario?.nome?.trim() || "Minha conta"}
          </p>

          <p className="text-xs text-muted">
            Minha área
          </p>
        </div>
      </div>

      <nav
        aria-label="Menu da minha conta"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
      >
        {itensVisiveis.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/perfil"}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-4 rounded-lg px-4 text-sm transition ${
                isActive
                  ? "bg-[#fae7de] font-semibold text-terracotta"
                  : "text-slatebrand hover:bg-softsage"
              }`
            }
          >
            <span
              aria-hidden="true"
              className="w-5 text-center text-lg"
            >
              {item.icon}
            </span>

            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Encerramento seguro da sessão */}
      <LogoutButton />
    </aside>
  );
}

function Overview() {
  return <div className="space-y-7"><PersonalData /><OrdersSummary /><AccountOrders /></div>;
}

export default function MyProfile() {
  const { pathname } = useLocation();

  const pages = {
    "/perfil": <Overview />,
    "/perfil/andamento": <AccountOrders andamento />,
    "/perfil/seguranca": <AccountSecurity />,
  };

  return (
    <div className="min-h-[65vh]">
      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              Minha conta
            </h1>

            <p className="mt-2 text-sm text-muted">
              Acompanhe sua conta e suas compras em um só lugar.
            </p>
          </div>

          <Link to="/loja" className={primaryButton}>
            ← Voltar para a loja
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <Sidebar />

          <div className="min-w-0">
            {pages[pathname] || <Overview />}
          </div>
        </div>
      </div>
    </div>
  );
}
