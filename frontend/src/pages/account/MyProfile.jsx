
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useStore } from "../../components/layout/StoreLayout.jsx";
import { formatPrice } from "../../data/products.js";

const menuItems = [
  { label: "Visão geral", icon: "⌂", to: "/perfil" },
  { label: "Meus pedidos", icon: "▤", to: "/perfil/pedidos" },
  { label: "Meus endereços", icon: "⌖", to: "/perfil/enderecos" },
  { label: "Favoritos", icon: "♡", to: "/favoritos" },
  { label: "Dados pessoais", icon: "♙", to: "/perfil/dados" },
  { label: "Cargo", icon: "♙", to: "/perfil/cargo" },
  { label: "Segurança", icon: "◇", to: "/perfil/seguranca" },
];

const fieldClass =
  "mt-2 h-11 w-full rounded-lg border border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 focus:border-sage";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-terracotta px-5 text-sm font-semibold text-white transition hover:brightness-95";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-slatebrand transition hover:bg-softsage";

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

function EmptyState({
  title,
  description,
  actionLabel,
  actionTo = "/loja",
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-softsage text-3xl text-terracotta">
        ✦
      </div>

      <h2 className="mt-6 font-display text-xl font-semibold">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
        {description}
      </p>

      {actionLabel && (
        <Link to={actionTo} className={`${primaryButton} mt-7`}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="self-start rounded-2xl bg-white p-5 lg:sticky lg:top-36">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fae7de] text-2xl text-terracotta">
          ♡
        </div>

        <div>
          <p className="text-sm font-semibold">
            Clube Planner
          </p>
          <p className="text-xs text-muted">
            Minha área
          </p>
        </div>
      </div>

      <nav aria-label="Menu da minha conta" className="space-y-2">
        {menuItems.map((item) => (
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
            <span aria-hidden="true" className="w-5 text-center text-lg">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Link
        to="/"
        className="mt-8 inline-flex rounded-lg px-4 py-3 text-sm font-semibold hover:bg-softsage"
      >
        Ir para o login
      </Link>
    </aside>
  );
}

function SummaryCard({ title, value, to, color }) {
  return (
    <article className="flex min-h-28 items-center gap-4 rounded-xl bg-white p-4">
      <div className={`h-11 w-11 shrink-0 rounded-lg ${color}`} />

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{title}</p>
        <p className="mt-1 font-display text-2xl font-semibold">
          {String(value).padStart(2, "0")}
        </p>
      </div>

      <Link
        to={to}
        className="rounded-lg bg-terracotta px-3 py-2 text-xs font-semibold text-white"
      >
        Detalhes
      </Link>
    </article>
  );
}

function PersonalData() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });

  const [notice, setNotice] = useState("");

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setNotice("");
  }

  function submit(event) {
    event.preventDefault();
    setNotice(
      "Os dados ainda não foram enviados ao servidor. A edição será habilitada após a integração da conta autenticada."
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Dados pessoais"
        description="Mantenha suas informações atualizadas."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Nome completo
              <input
                className={fieldClass}
                value={form.name}
                onChange={(event) =>
                  update("name", event.target.value)
                }
                placeholder="Seu nome"
                autoComplete="name"
              />
            </label>

            <label className="text-xs text-muted">
              E-mail
              <input
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(event) =>
                  update("email", event.target.value)
                }
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </label>

            <label className="text-xs text-muted">
              CPF
              <input
                className={fieldClass}
                value={form.cpf}
                onChange={(event) =>
                  update(
                    "cpf",
                    event.target.value.replace(/\D/g, "").slice(0, 11)
                  )
                }
                placeholder="Somente números"
                inputMode="numeric"
                maxLength={11}
              />
            </label>

            <label className="text-xs text-muted">
              Telefone
              <input
                type="tel"
                className={fieldClass}
                value={form.phone}
                onChange={(event) =>
                  update("phone", event.target.value)
                }
                placeholder="(00) 00000-0000"
                autoComplete="tel"
              />
            </label>
          </div>

          <button type="submit" className={primaryButton}>
            Salvar alterações
          </button>

          {notice && (
            <p role="status" className="rounded-lg bg-softsage p-3 text-sm">
              {notice}
            </p>
          )}
        </form>
      </Panel>

      <Panel
        title="Meus cartões"
        description="Consulte os métodos de pagamento vinculados à sua conta."
      >
        <div className="rounded-xl bg-sand p-5">
          <p className="font-semibold">Nenhum cartão vinculado</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Os cartões utilizados nas compras aparecerão aqui
            somente quando o provedor de pagamento disponibilizar
            um método de pagamento salvo e autorizado.
          </p>
          <p className="mt-3 text-xs text-muted">
            O Clube Planner não deve armazenar números completos
            de cartões nem códigos de segurança.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Overview() {
  const { favorites } = useStore();

  return (
    <div className="space-y-7">
      <PersonalData />

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">
          Resumo das compras
        </h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Pedidos realizados"
            value={0}
            to="/perfil/pedidos"
            color="bg-[#e8ebf5]"
          />

          <SummaryCard
            title="Em andamento"
            value={0}
            to="/perfil/andamento"
            color="bg-[#faf1d3]"
          />

          <SummaryCard
            title="Itens favoritos"
            value={favorites.length}
            to="/favoritos"
            color="bg-[#fae7de]"
          />
        </div>
      </section>

      <Panel title="Pedido recente">
        <p className="text-sm text-muted">
          Seus pedidos aparecerão aqui quando o histórico
          de compras estiver integrado ao backend.
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
      </Panel>
    </div>
  );
}

function Orders() {
  const [filter, setFilter] = useState("todos");

  const filters = [
    { id: "todos", label: "Todos os pedidos" },
    { id: "30", label: "Últimos 30 dias" },
    { id: "180", label: "Últimos 6 meses" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-semibold">
          Pedidos realizados
        </h2>
        <p className="mt-2 text-sm text-muted">
          Consulte seu histórico de compras e os detalhes de cada pedido.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-3">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={`rounded-lg px-4 py-3 text-sm ${
              filter === item.id
                ? "bg-softsage font-semibold text-slatebrand"
                : "hover:bg-sand"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EmptyState
        title="Nenhum pedido encontrado"
        description="Quando você finalizar uma compra, seu pedido aparecerá nesta seção. O histórico será carregado da sua conta."
        actionLabel="Explorar produtos"
      />
    </div>
  );
}

function InProgress() {
  const steps = [
    "Pedido confirmado",
    "Pagamento aprovado",
    "Preparando pedido",
    "Em transporte",
    "Entregue",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-semibold">
          Pedidos em andamento
        </h2>
        <p className="mt-2 text-sm text-muted">
          Acompanhe as etapas do seu pedido até a entrega.
        </p>
      </div>

      <Panel title="Acompanhamento de pedidos">
        <div className="grid gap-3 sm:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line bg-sand text-xs font-semibold">
                {index + 1}
              </div>
              <p className="mt-3 text-xs">{step}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted">
          As etapas serão atualizadas com os dados reais
          de cada pedido. Nenhum pedido está sendo
          acompanhado no momento.
        </p>
      </Panel>

      <Link to="/perfil/pedidos" className={secondaryButton}>
        Ver todos os pedidos
      </Link>
    </div>
  );
}

function Addresses() {
  return (
    <div className="space-y-6">
      <Panel
        title="Meus endereços"
        description="Consulte os endereços cadastrados durante suas compras."
      >
        <div className="rounded-xl bg-sand p-5">
          <h3 className="font-semibold">
            Nenhum endereço disponível
          </h3>

          <p className="mt-3 text-sm leading-7 text-muted">
            Os endereços vinculados à sua conta aparecerão
            aqui quando a integração com o cadastro e o
            checkout estiver concluída.
          </p>

          <p className="mt-3 text-xs text-muted">
            Endereços de entrega devem ser associados
            ao usuário autenticado no backend.
          </p>
        </div>
      </Panel>

      <Link to="/loja" className={secondaryButton}>
        Voltar para a loja
      </Link>
    </div>
  );
}

function Role() {
  const roles = [
    {
      name: "Visitante",
      description: "Acessa a loja sem autenticação.",
    },
    {
      name: "Cliente",
      description: "Conta autenticada para compras e pedidos.",
    },
    {
      name: "Vendedor",
      description: "Permissões comerciais autorizadas.",
    },
    {
      name: "Admin",
      description: "Gerenciamento administrativo autorizado.",
    },
  ];

  return (
    <Panel
      title="Cargo e permissões"
      description="Seu cargo determina os recursos disponíveis na plataforma."
    >
      <div className="rounded-xl bg-softsage p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Acesso atual
        </p>

        <h3 className="mt-2 font-display text-2xl font-semibold">
          Visitante
        </h3>

        <p className="mt-2 text-sm leading-6">
          A autenticação ainda não está conectada a esta
          interface. O cargo será identificado pelo servidor
          após a validação da sessão.
        </p>
      </div>

      <h3 className="mt-7 font-semibold">
        Cargos da plataforma
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.name}
            className="rounded-xl border border-line p-4"
          >
            <p className="font-semibold">{role.name}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {role.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 rounded-xl bg-[#faf1d3] p-4 text-sm leading-6">
        Seu cargo não pode ser alterado por esta página.
        A atribuição de permissões é exclusiva de
        administradores autorizados e deve ser validada
        pelo backend.
      </p>
    </Panel>
  );
}

function Security() {
  return (
    <div className="space-y-6">
      <Panel
        title="Segurança da conta"
        description="Gerencie a proteção dos seus dados e acessos."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line p-5">
            <h3 className="font-semibold">
              Alterar senha
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              A alteração de senha será disponibilizada
              quando o fluxo autenticado de recuperação
              e redefinição estiver integrado ao backend.
            </p>
          </div>

          <div className="rounded-xl border border-line p-5">
            <h3 className="font-semibold">
              Sessões e dispositivos
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Aqui você poderá consultar sessões ativas
              e encerrar acessos quando esse recurso
              estiver disponível.
            </p>
          </div>

          <div className="rounded-xl border border-line p-5">
            <h3 className="font-semibold">
              Verificação da conta
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              O status de verificação de e-mail será
              apresentado a partir dos dados do servidor.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function FavoritesPage() {
  const { favorites, toggleFavorite, addToCart } = useStore();

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/loja">Início</Link>
        {" / "}
        <Link to="/perfil">Minha conta</Link>
        {" / Favoritos"}
      </nav>

      <h1 className="font-display text-3xl font-semibold">
        Meus favoritos
      </h1>

      <p className="mt-2 text-sm text-muted">
        Seus produtos preferidos, sempre por perto.
      </p>

      <p className="mb-6 mt-8 font-semibold">
        {favorites.length} produtos salvos
      </p>

      {favorites.length === 0 ? (
        <EmptyState
          title="Sua lista de favoritos está vazia"
          description="Explore nossa papelaria e salve os produtos de que mais gostar."
          actionLabel="Explorar produtos"
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {favorites.map((product) => (
            <article
              key={product.id}
              className="flex flex-col rounded-2xl border border-line bg-white p-4"
            >
              <div
                className="flex h-40 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: product.background || "#e8f1e8",
                }}
              >
                <span className="font-display text-lg font-semibold">
                  {product.illustration || "CLUBE PLANNER"}
                </span>
              </div>

              <h2 className="mt-4 font-semibold">
                {product.name}
              </h2>

              <p className="mt-2 text-sm text-muted">
                {product.description}
              </p>

              <p className="mt-4 font-display text-xl font-semibold">
                {formatPrice(product.price)}
              </p>

              <div className="mt-auto flex flex-col gap-2 pt-5">
                <Link
                  to={`/produto/${product.id}`}
                  className={primaryButton}
                >
                  Ver detalhes
                </Link>

                <button
                  type="button"
                  onClick={() => addToCart(product)}
                  className={secondaryButton}
                >
                  Adicionar à sacola
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(product)}
                  className="py-2 text-sm font-semibold text-terracotta"
                >
                  Remover dos favoritos
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyProfile() {
  const { pathname } = useLocation();

  const pages = {
    "/perfil": <Overview />,
    "/perfil/pedidos": <Orders />,
    "/perfil/andamento": <InProgress />,
    "/perfil/enderecos": <Addresses />,
    "/perfil/dados": <PersonalData />,
    "/perfil/cargo": <Role />,
    "/perfil/seguranca": <Security />,
  };

  return (
    <div className="min-h-[65vh] bg-sand">
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
