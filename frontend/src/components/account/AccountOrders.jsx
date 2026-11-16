import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { shopApi } from "../../services/shopApi.js";
import { formatPrice } from "../../data/products.js";

import { statusPedido } from "../../data/orderStatus.js";
const confirmados = ["pago", "em_preparacao", "enviado", "entregue"];
function usePedidos() {
  const { accessToken } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    let executando = false;
    const carregar = async () => {
      if (executando || document.visibilityState === 'hidden') return;
      executando = true;
      let aviso = '';
      try {
        try {
          const resultado = await shopApi('/orders/sync', accessToken, {});
          if (resultado.falhas) aviso = 'A confirmação de alguns pagamentos está indisponível. Tentaremos novamente automaticamente.';
        } catch { aviso = 'Não foi possível atualizar os pagamentos agora. Exibindo a última situação registrada.'; }
        const dados = await shopApi('/orders', accessToken);
        if (ativo) { setPedidos(dados.pedidos); setErro(aviso); }
      } catch (error) { if (ativo) setErro(error.message); }
      finally { executando = false; if (ativo) setCarregando(false); }
    };
    void carregar();
    const timer = setInterval(carregar, 30000);
    window.addEventListener("focus", carregar);
    document.addEventListener("visibilitychange", carregar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", carregar); document.removeEventListener("visibilitychange", carregar); };
  }, [accessToken]);
  return { pedidos, erro, carregando };
}
function OrderCard({ pedido }) {
  return <article className="rounded-xl border border-line bg-white p-5">
    <div className="flex flex-wrap justify-between gap-3"><p className="font-semibold">Pedido #{pedido.id.slice(-8).toUpperCase()}</p><span className="text-sm">{statusPedido[pedido.status]}{pedido.pagamentoStatus === "aprovado" && <span className="block text-xs text-muted">Pagamento realizado</span>}</span></div>
    <p className="mt-2 text-xs text-muted">{new Date(pedido.criadoEm).toLocaleString("pt-BR")}{pedido.ambienteTeste ? " · Pedido de teste" : ""}</p>
    <p className="mt-4 text-sm">{pedido.itens.map((i) => `${i.nome} × ${i.quantidade}`).join(" · ")}</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><span className="font-semibold">{formatPrice(pedido.totalCentavos / 100)}</span><Link className="text-sm font-semibold text-terracotta underline" to={`/perfil/pedidos/${pedido.id}`}>Ver detalhes</Link></div>
  </article>;
}
export function OrdersSummary() {
  const { pedidos, erro, carregando } = usePedidos();
  const realizados = pedidos.filter((p) => confirmados.includes(p.status));
  const andamento = realizados.filter((p) => p.status !== "entregue");
  return <section className="space-y-5">
    <h2 className="font-display text-xl font-semibold">Resumo das compras</h2>
    {erro && <p role="alert" className="text-sm text-red-800">{erro}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{[["Pedidos realizados", realizados.length, "/perfil"], ["Em andamento", andamento.length, "/perfil/andamento"]].map(([titulo, valor, to]) => <Link key={to} to={to} className="rounded-xl bg-white p-5"><p className="text-sm">{titulo}</p><p className="mt-2 text-2xl font-semibold">{carregando ? "…" : valor}</p></Link>)}</div>
    <h2 className="font-display text-xl font-semibold">Pedido recente</h2>
    {carregando ? <p role="status">Carregando pedidos...</p> : realizados[0] ? <OrderCard pedido={realizados[0]} /> : <p className="rounded-xl bg-white p-5 text-sm">Você ainda não possui pedidos confirmados.</p>}
    {pedidos.some((p) => p.status === "aguardando_pagamento") && <Link to="/perfil#pedidos" className="block text-sm text-terracotta underline">Consultar pedidos aguardando pagamento</Link>}
  </section>;
}
export default function AccountOrders({ andamento = false }) {
  const { pedidos, erro, carregando } = usePedidos();
  const location = useLocation();
  const [dias, setDias] = useState("todos");
  const [agora] = useState(() => Date.now());
  useEffect(() => {
    if (!andamento && !carregando && location.hash === "#pedidos") {
      document.getElementById("pedidos")?.scrollIntoView({ block: "start" });
    }
  }, [andamento, carregando, location.key, location.hash]);
  const filtrados = pedidos.filter((p) => p.status !== "cancelado" && (!andamento || ["pago", "em_preparacao", "enviado"].includes(p.status)) && (dias === "todos" || agora - new Date(p.criadoEm).getTime() <= Number(dias) * 86400000));
  return <section id="pedidos" className="space-y-5 scroll-mt-40">
    {location.state?.pedidoCancelado && <p role="status" className="rounded-xl bg-softsage p-4 text-sm">Pedido cancelado com sucesso.</p>}
    <h2 className="font-display text-3xl font-semibold">{andamento ? "Pedidos em andamento" : "Pedidos realizados"}</h2>
    <div className="flex flex-wrap gap-2">{[["todos", "Todos"], ["30", "Últimos 30 dias"], ["180", "Últimos 6 meses"]].map(([valor, label]) => <button key={valor} onClick={() => setDias(valor)} aria-pressed={dias === valor} className={`rounded-lg px-4 py-3 text-sm ${dias === valor ? "bg-softsage" : "bg-white"}`}>{label}</button>)}</div>
    {erro && <p role="alert" className="text-red-800">{erro}</p>}
    {carregando && <p role="status">Carregando pedidos...</p>}
    {!carregando && !erro && !filtrados.length && <p className="rounded-xl bg-white p-5">Nenhum pedido encontrado neste período.</p>}
    {filtrados.map((p) => <OrderCard key={p.id} pedido={p} />)}
  </section>;
}
