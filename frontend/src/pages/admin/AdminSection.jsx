
import { Link, useParams } from "react-router";

const sections = {
  dashboard: {
    title: "Visão geral da loja",
    description:
      "Acompanhe os indicadores financeiros, comerciais e operacionais do Clube Planner.",
    fields: [
      "Faturamento bruto e líquido",
      "Pedidos recebidos e concluídos",
      "Ticket médio e conversão",
      "Clientes novos e recorrentes",
      "Pagamentos pendentes",
      "Produtos com estoque crítico",
      "Evolução das vendas por período",
      "Pedidos que exigem atenção",
    ],
  },
  produtos: {
    title: "Gerenciamento de produtos",
    description:
      "Administre o catálogo, os preços, o estoque e a disponibilidade dos produtos.",
    fields: [
      "Identificador e SKU",
      "Nome e descrição",
      "Categoria e variações",
      "Preço de venda e custo",
      "Estoque atual e mínimo",
      "Status de publicação",
      "Data da última alteração",
      "Histórico de movimentações",
    ],
  },
  categorias: {
    title: "Gerenciamento de categorias",
    description:
      "Organize a estrutura do catálogo e a apresentação das categorias na loja.",
    fields: [
      "Identificador da categoria",
      "Nome e descrição",
      "Quantidade de produtos",
      "Status de visibilidade",
      "Ordem de exibição",
      "Data de criação",
      "Última atualização",
      "Vínculos com produtos",
    ],
  },
  pedidos: {
    title: "Gerenciamento de pedidos",
    description:
      "Acompanhe cada pedido desde sua criação até a entrega.",
    fields: [
      "Número e data do pedido",
      "Identificação do cliente",
      "Itens e quantidades",
      "Subtotal, descontos e frete",
      "Status do pagamento",
      "Status de preparação e envio",
      "Endereço de entrega",
      "Histórico de eventos",
    ],
  },
  vendas: {
    title: "Gestão financeira de vendas",
    description:
      "Consulte transações, pagamentos, descontos, taxas e reembolsos.",
    fields: [
      "Identificador da transação",
      "Pedido relacionado",
      "Método de pagamento",
      "Valor bruto e descontos",
      "Taxas e valor líquido",
      "Status financeiro",
      "Data de confirmação",
      "Reembolso e conciliação",
    ],
  },
  clientes: {
    title: "Gerenciamento de clientes",
    description:
      "Consulte cadastros e acompanhe o relacionamento com os clientes.",
    fields: [
      "Identificador do cliente",
      "Nome e e-mail",
      "Data de cadastro",
      "Situação da conta",
      "Cargo e permissões",
      "Total de pedidos",
      "Última atividade",
      "Histórico de alterações",
    ],
  },
  relatorios: {
    title: "Relatórios gerenciais",
    description:
      "Analise o desempenho da loja com indicadores e relatórios detalhados.",
    fields: [
      "Receita por período",
      "Pedidos por situação",
      "Vendas por categoria",
      "Produtos mais vendidos",
      "Descontos e cupons",
      "Clientes novos e recorrentes",
      "Taxas de conversão",
      "Exportação de relatórios",
    ],
  },
  configuracoes: {
    title: "Configurações administrativas",
    description:
      "Gerencie as preferências operacionais e as informações institucionais.",
    fields: [
      "Dados da loja",
      "Identidade visual",
      "Entrega e frete",
      "Provedores de pagamento",
      "Notificações",
      "Cargos e permissões",
      "Privacidade e segurança",
      "Auditoria de configurações",
    ],
  },
};

export default function AdminSection({
  section = "dashboard",
}) {
  const { section: routeSection } = useParams();

  const key = routeSection || section;
  const data = sections[key];

  if (!data) {
    return (
      <section className="rounded-2xl bg-white p-8">
        <h2 className="text-xl font-bold">
          Seção não encontrada
        </h2>

        <Link
          to="/admin-demo"
          className="mt-5 inline-block text-[#d86f58]"
        >
          Voltar ao dashboard
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#d86f58]">
            Clube Planner / Administração
          </p>

          <h2 className="mt-2 font-display text-2xl font-bold">
            {data.title}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#81849a]">
            {data.description}
          </p>
        </div>

        <span className="rounded-full border border-[#e5e1d5] bg-white px-4 py-2 text-xs font-semibold">
          Estrutura inicial
        </span>
      </div>

      <section className="rounded-2xl border border-[#e5e1d5] bg-white p-6 sm:p-8">
        <h3 className="font-display text-lg font-bold">
          Integração de dados
        </h3>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#81849a]">
          Esta seção ainda não está conectada ao serviço
          administrativo. Os registros e indicadores serão
          apresentados após a implementação da interface
          específica e da integração autorizada com a API.
        </p>

        <div className="mt-6 rounded-xl bg-[#e6eee8] p-5">
          <p className="text-sm font-semibold">
            Nenhum dado administrativo carregado
          </p>

          <p className="mt-2 text-xs leading-6">
            Nenhuma venda, pedido, cliente ou movimentação
            está sendo presumida nesta visualização.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e1d5] bg-white p-6 sm:p-8">
        <h3 className="font-display text-lg font-bold">
          Informações previstas para esta interface
        </h3>

        <p className="mt-2 text-sm text-[#81849a]">
          Campos que serão apresentados com identificação
          clara, filtros e detalhamento quando aplicáveis.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.fields.map((field, index) => (
            <div
              key={field}
              className="rounded-xl border border-[#e5e1d5] bg-[#fcfbf7] p-4"
            >
              <span className="text-xs font-bold text-[#d86f58]">
                {String(index + 1).padStart(2, "0")}
              </span>

              <p className="mt-3 text-sm font-semibold leading-6">
                {field}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
