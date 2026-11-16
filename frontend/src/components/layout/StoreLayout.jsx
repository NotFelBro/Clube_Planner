import InfoSidebar from "./InfoSidebar.jsx";
import { siteSections } from "../../data/siteSections.js";
import BrandLogo from "../brand/BrandLogo.jsx";
import { mergeCatalogImages } from "../../data/products.js";
import { shopApi } from "../../services/shopApi.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

import { useEffect, useState } from "react";
import { StoreContext } from "./StoreContext.js";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

const categories = [
  { label: "Planners & agendas", category: "planners" },
  { label: "Cadernos & blocos", category: "cadernos" },
  { label: "Canetas & acessórios", category: "canetas" },
];

function categoryPath(category) {

  return `/colecoes?categoria=${category}`;
}

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" />
    </svg>
  );
}

function ShoppingBagIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h16l-1 13H5L4 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

function CountBadge({ count }) {
  return (
    <span
      className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] bg-terracotta px-1.5 text-[11px] font-bold leading-none text-white"
      aria-label={`${count} itens`}
    >
      {count}
    </span>
  );
}

function Brand() {
  return (
    <Link
      to="/loja"
      className="flex min-w-0 items-center"
      aria-label="Clube Planner — página inicial"
    >
      <BrandLogo className="w-40 sm:w-52" />
    </Link>
  );
}

function Header({
  cartCount,
  search,
  setSearch,
  storeCategories,
  loja,
}) {
  const { usuario } = useAuth();
  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const activeCategory = ["/loja", "/colecoes"].includes(location.pathname)
    ? new URLSearchParams(location.search).get("categoria")
    : null;
  const navigate = useNavigate();

  function handleSearchSubmit(event) {
    event.preventDefault();

    navigate("/loja");

    window.requestAnimationFrame(() => {
      document
        .getElementById("produtos-destaque")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  return (
    <>
      <div className="bg-slatebrand px-4 py-3 text-center text-xs text-white">
        {loja?.mensagemTopo || "Frete a partir de R$ 3,00 • Calculado pelo CEP de entrega"}
      </div>

        <header className="sticky top-0 z-50 w-full shrink-0 border-b border-line bg-sand shadow-sm">
          <div className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 px-4 py-4 sm:gap-x-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)_minmax(0,1fr)]">
            <Brand />

            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="col-span-2 row-start-2 flex w-full min-w-0 items-center rounded-xl border border-line bg-white px-4 lg:col-span-1 lg:row-start-auto lg:max-w-[500px] lg:justify-self-center"
            >
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Busque planners, cadernos e papelaria criativa"
                aria-label="Pesquisar produtos"
                className="h-[46px] w-full min-w-0 bg-transparent px-3 text-sm text-slatebrand outline-none placeholder:text-muted"
              />
            </form>

            <nav
              aria-label="Ações da conta"
              className="flex min-w-0 items-center justify-end gap-2 text-xs sm:gap-6 sm:text-sm"
            >

              <NavLink
                to="/perfil"
                className="flex min-h-11 items-center gap-1.5 whitespace-nowrap transition hover:text-terracotta"
              >
                <UserIcon />
                <span className="max-w-36 truncate">{primeiroNome ? `Olá, ${primeiroNome}.` : "Entrar"}</span>
              </NavLink>

              <NavLink
                to="/sacola"
                className="flex min-h-11 items-center gap-1.5 whitespace-nowrap transition hover:text-terracotta"
                aria-label={`Sacola de compras com ${cartCount} produtos`}
              >
                <ShoppingBagIcon />
                <span className="hidden sm:inline">Sacola</span>
                <CountBadge count={cartCount} />
              </NavLink>
            </nav>
          </div>
        </header>

        <div className="shrink-0 border-b border-line bg-white">
          <div className="mx-auto grid max-w-[1320px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)_minmax(0,1fr)] lg:gap-x-5">
            <InfoSidebar />
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between py-3 text-sm font-semibold lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="store-categories"
              onClick={() =>
                setMenuOpen((previous) => !previous)
              }
            >
              Categorias da loja

              <span aria-hidden="true">
                {menuOpen ? "−" : "+"}
              </span>
            </button>

            <nav
              id="store-categories"
              aria-label="Categorias da loja"
              className={`${
                menuOpen ? "flex" : "hidden"
              } col-span-2 flex-col items-center gap-1 pb-3 lg:col-span-1 lg:col-start-2 lg:flex lg:flex-row lg:justify-between lg:gap-4 lg:py-4`}
            >
              {(Array.isArray(storeCategories) ? storeCategories.map(c => ({ label: c.name, category: c.id })) : categories).map(({ label, category }) => (
                <Link
                  key={category}
                  to={categoryPath(category)}
                  onClick={() => setMenuOpen(false)}
                  aria-current={activeCategory === category ? "page" : undefined}
                  className="store-category rounded-lg px-3 py-2 text-[13px] font-medium"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
    </>
  );
}

function Footer({ loja }) {
  return (
    <footer className="bg-slatebrand text-sand">
      <div className="mx-auto grid max-w-[1320px] gap-9 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/loja" aria-label="Clube Planner — página inicial" className="inline-block max-w-full">
            <BrandLogo inverse className="w-60" />
          </Link>

          <p className="mt-5 max-w-[250px] text-[13px] leading-6">
            Papelaria feita pra organizar a vida e
            transformar rotina em leveza.
          </p>
        </div>

        {siteSections.map((section) => (
          <div key={section.id}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sage">{section.title}</h2>
            <ul className="mt-4 flex flex-col gap-2 text-[13px]">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            {section.id === "atendimento" && loja?.emailAtendimento && <li><a href={`mailto:${loja.emailAtendimento}`}>{loja.emailAtendimento}</a></li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 border-t border-white/20 px-5 py-5 text-[11px] sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {loja?.nome || "Clube Planner"}.
          Todos os direitos reservados.
        </p>

        <p>
          Compra segura • Privacidade protegida
        </p>
      </div>
    </footer>
  );
}

export default function StoreLayout() {
  const { usuario } = useAuth();
  return <StoreLayoutContent key={usuario?.id || "visitante"} userId={usuario?.id || "visitante"} />;
}

function StoreLayoutContent({ userId }) {
  const storageKey = `clube-sacola-${userId}`;
  const [cartItems, setCart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("clube-sacola-visitante") || "[]");
      return Array.isArray(saved) ? saved.filter((p) => Number.isSafeInteger(p?.id) && p.id > 0).slice(0, 9900) : [];
    } catch { return []; }
  });
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [checkoutConfig, setCheckoutConfig] = useState(null);
  useEffect(() => {
    let ativo = true;
    let carregando = false;
    const carregar = async () => {
      if (carregando) return;
      carregando = true;
      try { const dados = await shopApi("/catalog"); if (ativo) { setProducts(mergeCatalogImages(dados.produtos)); setCheckoutConfig(dados); setCatalogError(""); } }
      catch (error) { if (ativo) setCatalogError(error.message); }
      finally { carregando = false; if (ativo) setCatalogLoading(false); }
    };
    void carregar();
    const timer = setInterval(carregar, 30000);
    const atualizar = event => { if (event.type !== "storage" || event.key === "clube-catalogo-revisao") void carregar(); };
    window.addEventListener("focus", atualizar); window.addEventListener("storage", atualizar); window.addEventListener("clube-catalogo-atualizado", atualizar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", atualizar); window.removeEventListener("storage", atualizar); window.removeEventListener("clube-catalogo-atualizado", atualizar); };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cartItems.map((p) => ({ id: p.id }))));
      if (userId !== "visitante") localStorage.removeItem("clube-sacola-visitante");
    } catch { /* A compra continua disponível quando o navegador bloqueia armazenamento. */ }
  }, [storageKey, userId, cartItems]);
  const cart = cartItems.map((item) => products.find((p) => p.id === item.id)).filter(Boolean);
  const [search, setSearch] = useState("");

  function addToCart(product) {
    setCart((previous) => previous.filter((p) => p.id === product.id).length >= Math.min(99, product.stock ?? 99) ? previous : [...previous, { id: product.id }]);
  }

  function removeFromCart(productId) {
    setCart((previous) =>
      previous.filter(
        (item) => item.id !== productId
      )
    );
  }

  function updateCartQuantity(productId, quantity) {
    const nextQuantity = Math.max(
      0,
      Math.min(99, products.find(p => p.id === productId)?.stock ?? 99, Math.trunc(Number(quantity) || 0))
    );

    setCart((previous) => {
      const product = previous.find(
        (item) => item.id === productId
      );

      if (!product) return previous;

      const otherProducts = previous.filter(
        (item) => item.id !== productId
      );

      return [
        ...otherProducts,
        ...Array.from(
          { length: nextQuantity },
          () => product
        ),
      ];
    });
  }

  function clearCart() {
    setCart([]);
  }

  const cartSubtotal = cart.reduce(
    (total, product) =>
      total + Number(product.price || 0),
    0
  );

  const store = {
    products,
    checkoutConfig,
    categories: checkoutConfig?.categorias || [],
    catalogLoading,
    catalogError,
    cart,
    cartCount: cart.length,
    cartSubtotal,
    search,
    setSearch,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
  };

  return (
    <StoreContext.Provider value={store}>
      <div className="flex min-h-screen min-w-0 flex-col bg-sand text-slatebrand">
        <Header
          storeCategories={checkoutConfig?.categorias}
          loja={checkoutConfig?.loja}
          cartCount={cart.length}
          search={search}
          setSearch={setSearch}
        />

        <main
          id="conteudo"
          className="wallpaper-light w-full min-w-0 flex-1"
        >
          {catalogError && <p role="alert" className="mx-auto max-w-5xl rounded-lg bg-red-50 p-4 text-sm text-red-800">{catalogError} Atualize a página para tentar novamente.</p>}
          {catalogLoading ? <p role="status" className="p-10 text-center">Carregando loja...</p> : <Outlet context={store} />}
        </main>

        <Footer loja={checkoutConfig?.loja} />
      </div>
    </StoreContext.Provider>
  );
}
