import ErrorBoundary from "../ErrorBoundary.jsx";
import BrandLogo from "../brand/BrandLogo.jsx";

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from "react-router";

const menu = [
  { label: "Dashboard", path: "", icon: "▦" },
  { label: "Produtos", path: "produtos", icon: "▤" },
  { label: "Categorias", path: "categorias", icon: "▧" },
  { label: "Pedidos", path: "pedidos", icon: "▣" },
  { label: "Vendas", path: "vendas", icon: "◫" },
  { label: "Clientes", path: "clientes", icon: "♙" },
  { label: "Configurações", path: "configuracoes", icon: "⚙" },
];

const titles = {
  "": "Dashboard",
  produtos: "Produtos",
  categorias: "Categorias",
  pedidos: "Pedidos",
  vendas: "Vendas",
  clientes: "Clientes",
  configuracoes: "Configurações",
};

export default function AdminLayout({
  preview = false,
}) {
  const { usuario } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const base = preview ? "/admin-demo" : "/admin";
  const current = location.pathname
    .replace(base, "")
    .split("/")
    .filter(Boolean)[0] || "";

  return (
    <div className="min-h-screen bg-[#f5f1df] text-[#3d415f] lg:flex">
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-[#3d415f] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-6 py-7">
          <Link to="/loja" aria-label="Clube Planner — página inicial" className="block max-w-full">
            <BrandLogo inverse className="w-full" />
          </Link>

          <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-[#91b8a4]">
            Painel administrativo
          </p>
        </div>

        <nav
          aria-label="Menu administrativo"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
        >
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={
                item.path
                  ? `${base}/${item.path}`
                  : base
              }
              end={!item.path}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-4 text-sm transition ${
                  isActive
                    ? "bg-[#e67e63] font-semibold text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
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

        <div className="border-t border-white/10 p-4">
          <Link
            to="/perfil"
            className="block rounded-lg px-4 py-3 text-sm hover:bg-white/10"
          >
            ← Minha conta
          </Link>

          <Link
            to="/loja"
            className="block rounded-lg px-4 py-3 text-sm hover:bg-white/10"
          >
            Voltar para a loja
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-4 border-b border-[#e5e1d5] bg-white px-5 shadow-sm sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="rounded-lg border border-[#e5e1d5] px-3 py-2 lg:hidden"
            >
              ☰
            </button>

            <h1 className="min-w-0 font-display text-base font-bold sm:text-xl">
              {titles[current] || "Administração"}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                {preview ? "Pré-visualização" : usuario?.nome || "Administrador"}
              </p>

              <p className="text-xs text-[#81849a]">
                Clube Planner
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6eee8] text-[#3d415f]">
              ♙
            </div>
          </div>
        </header>

        {preview && (
          <div
            role="status"
            className="border-b border-[#e7d8a2] bg-[#fff4cf] px-5 py-3 text-center text-xs font-semibold sm:px-8"
          >
            Ambiente de pré-visualização — sem acesso a
            dados reais ou operações administrativas.
          </div>
        )}

        <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8">
          <ErrorBoundary compact key={location.pathname}><Outlet context={{ preview }} /></ErrorBoundary>
        </main>

        <footer className="px-5 pb-7 text-xs text-[#85879a] sm:px-8">
          Clube Planner • Painel de gestão
        </footer>
      </div>
    </div>
  );
}
