
import { createContext, useContext, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";

const StoreContext = createContext(null);

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error(
      "useStore deve ser utilizado dentro de StoreLayout."
    );
  }

  return context;
}

const categories = [
  { label: "Planners & agendas", category: "planners" },
  { label: "Cadernos & blocos", category: "cadernos" },
  { label: "Papelaria criativa", category: "papelaria" },
  { label: "Canetas & acessórios", category: "canetas" },
  { label: "Organização", category: "organizacao" },
  { label: "Novidades ✦", category: "novidades" },
];

function categoryPath(category) {
  if (category === "novidades") {
    return "/novidades";
  }

  if (category === "papelaria") {
    return "/loja?categoria=papelaria";
  }

  return `/colecoes?categoria=${category}`;
}

function HeartIcon() {
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
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-8Z" />
    </svg>
  );
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
      className="flex shrink-0 items-center gap-2"
      aria-label="Clube Planner — página inicial"
    >
      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-softsage text-2xl text-terracotta"
      >
        ✦
      </div>

      <div className="flex flex-col">
        <span className="font-display text-lg font-semibold leading-tight">
          Clube
          <span className="text-terracotta">Planner</span>
        </span>

        <span className="text-[8px] uppercase tracking-[0.18em] text-muted">
          Papelaria com afeto
        </span>
      </div>
    </Link>
  );
}

function Header({
  cartCount,
  favoritesCount,
  search,
  setSearch,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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
        Frete especial em compras selecionadas • Sua rotina merece leveza
      </div>

      <div className="sticky top-0 z-50 w-full shadow-sm">
        <header className="border-b border-line bg-sand">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:flex-nowrap">
            <Brand />

            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="order-3 flex w-full max-w-[500px] items-center rounded-xl border border-line bg-white px-4 lg:order-none"
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
              className="flex flex-wrap items-center gap-4 text-sm sm:gap-6"
            >
              <NavLink
                to="/favoritos"
                className="flex items-center gap-1.5 whitespace-nowrap transition hover:text-terracotta"
              >
                <HeartIcon />
                <span>Favoritos</span>
                <CountBadge count={favoritesCount} />
              </NavLink>

              <NavLink
                to="/perfil"
                className="flex items-center gap-1.5 whitespace-nowrap transition hover:text-terracotta"
              >
                <UserIcon />
                <span>Meu perfil</span>
              </NavLink>

              <NavLink
                to="/sacola"
                className="flex items-center gap-2 whitespace-nowrap transition hover:text-terracotta"
                aria-label={`Sacola de compras com ${cartCount} produtos`}
              >
                <ShoppingBagIcon />
                <span>Sacola</span>
                <CountBadge count={cartCount} />
              </NavLink>
            </nav>
          </div>
        </header>

        <div className="border-b border-line bg-white">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
            <button
              type="button"
              className="flex w-full items-center justify-between py-3 text-sm font-semibold lg:hidden"
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
              } flex-col gap-1 pb-3 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:py-4`}
            >
              {categories.map(({ label, category }) => (
                <Link
                  key={category}
                  to={categoryPath(category)}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-[13px] font-medium transition hover:bg-softsage hover:text-terracotta lg:px-0 lg:py-0 lg:hover:bg-transparent ${
                    category === "novidades"
                      ? "text-terracotta"
                      : ""
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="bg-slatebrand text-sand">
      <div className="mx-auto grid max-w-[1320px] gap-9 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Clube
            <span className="text-terracotta">
              Planner
            </span>
          </h2>

          <p className="mt-5 max-w-[250px] text-[13px] leading-6">
            Papelaria feita pra organizar a vida e
            transformar rotina em leveza.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sage">
            Atendimento
          </h2>

          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            <span>Fale com a gente</span>
            <span>Central de ajuda</span>
            <span>Trocas e devoluções</span>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sage">
            Institucional
          </h2>

          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            <span>Sobre o Clube Planner</span>
            <span>Privacidade</span>
            <span>Termos de uso</span>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sage">
            Acompanhe
          </h2>

          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            <span>Instagram • Pinterest</span>
            <span>Novidades e inspiração</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 border-t border-white/20 px-5 py-5 text-[11px] sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} Clube Planner.
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
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState("");

  function addToCart(product) {
    setCart((previous) => [...previous, product]);
  }

  function toggleFavorite(product) {
    setFavorites((previous) =>
      previous.some((item) => item.id === product.id)
        ? previous.filter(
            (item) => item.id !== product.id
          )
        : [...previous, product]
    );
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
      Math.min(99, Math.trunc(Number(quantity) || 0))
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
    cart,
    cartCount: cart.length,
    cartSubtotal,
    favorites,
    search,
    setSearch,
    addToCart,
    toggleFavorite,
    removeFromCart,
    updateCartQuantity,
    clearCart,
  };

  return (
    <StoreContext.Provider value={store}>
      <div className="flex min-h-screen flex-col bg-sand text-slatebrand">
        <Header
          cartCount={cart.length}
          favoritesCount={favorites.length}
          search={search}
          setSearch={setSearch}
        />

        <main
          id="conteudo"
          className="w-full flex-1"
        >
          <Outlet context={store} />
        </main>

        <Footer />
      </div>
    </StoreContext.Provider>
  );
}
