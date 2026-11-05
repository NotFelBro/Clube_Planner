
import { Link, useParams } from "react-router";

export default function OrderDetails() {
  const { id } = useParams();

  return (
    <main className="min-h-[70vh] bg-sand px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <nav className="mb-8 flex flex-wrap gap-2 text-xs text-muted">
          <Link to="/loja">Início</Link>
          <span>/</span>
          <Link to="/perfil">Minha conta</Link>
          <span>/</span>
          <Link to="/perfil/pedidos">Meus pedidos</Link>
          <span>/</span>
          <span>Detalhes</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold">
          Detalhes do pedido
        </h1>

        <p className="mt-2 text-sm text-muted">
          Consulte os produtos, valores e andamento do seu pedido.
        </p>

        <section className="mt-8 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">
              Pedido {id}
            </h2>

            <span className="rounded-full bg-softsage px-4 py-2 text-xs font-semibold">
              Aguardando consulta
            </span>
          </div>

          <div className="mt-7 rounded-xl bg-sand p-6">
            <p className="font-semibold">
              Dados do pedido ainda não disponíveis
            </p>

            <p className="mt-3 text-sm leading-7 text-muted">
              Os detalhes serão apresentados após a integração
              com o histórico de pedidos do backend. Não é
              possível confirmar produtos, pagamento ou entrega
              apenas pelo identificador da URL.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/perfil/pedidos"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-terracotta px-6 text-sm font-semibold text-white"
            >
              Voltar aos meus pedidos
            </Link>

            <Link
              to="/loja"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-6 text-sm font-semibold hover:bg-softsage"
            >
              Voltar para a loja
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
