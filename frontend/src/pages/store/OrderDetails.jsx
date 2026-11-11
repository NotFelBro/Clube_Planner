import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { shopApi } from "../../services/shopApi.js";
import { formatPrice } from "../../data/products.js";
import { statusPedido } from "../../data/orderStatus.js";

export default function OrderDetails() {
  const { id } = useParams();
  return <OrderContent key={id} id={id} />;
}
function OrderContent({ id }) {
  const { accessToken } = useAuth();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const dados = await shopApi(`/orders/${id}`, accessToken);
        if (ativo) setPedido(dados.pedido);
        if (dados.pedido.pagamentoTipo === "mercado_pago" && dados.pedido.status === "aguardando_pagamento") {
          const atualizado = await shopApi(`/orders/${id}/sync`, accessToken, {});
          if (ativo) setPedido(atualizado.pedido);
        }
      } catch (error) { if (ativo) setErro(error.message); }
    }
    void carregar();
    const timer = setInterval(carregar, 15000);
    return () => { ativo = false; clearInterval(timer); };
  }, [id, accessToken]);
  async function acao(tipo) {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try {
      const dados = await shopApi(`/orders/${id}/${tipo}`, accessToken, {});
      setPedido(dados.pedido);
      if (tipo === "payment" && dados.pedido.checkoutUrl) window.location.assign(dados.pedido.checkoutUrl);
    } catch (error) { setErro(error.message); }
    finally { setOcupado(false); }
  }
  const etapas = ["pago", "em_preparacao", "enviado", "entregue"];
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-10">
    <Link to="/perfil" className="return-action">← Visão geral</Link>
    <h1 className="mt-5 font-display text-3xl font-semibold">Detalhes do pedido</h1>
    {erro && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
    {!pedido && !erro && <p role="status" className="mt-6">Carregando pedido...</p>}
    {pedido && <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Pedido #{pedido.id.slice(-8).toUpperCase()}</h2><p>{statusPedido[pedido.status]}</p></div>
        <p className="mt-2 text-sm text-muted">{new Date(pedido.criadoEm).toLocaleString("pt-BR")}{pedido.ambienteTeste ? " · Teste, sem envio real" : ""}</p>
        <p className="mt-4 text-sm">{pedido.pagamentoTipo === "gratuito" ? "Pedido gratuito confirmado. Pagamento dispensado; nenhuma cobrança foi realizada." : `Mercado Pago · ${pedido.pagamentoStatus || "Aguardando pagamento"}`}</p>
        {pedido.pagamentoTipo === "mercado_pago" && pedido.status === "aguardando_pagamento" && <div className="mt-5 flex flex-wrap gap-3"><button disabled={ocupado} onClick={() => acao("payment")} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{ocupado ? "Aguarde..." : "Pagar no Mercado Pago (teste)"}</button><button disabled={ocupado} onClick={() => acao("sync")} className="rounded-xl border border-line px-5 py-3 text-sm">Atualizar pagamento</button></div>}
        {pedido.status !== "cancelado" && <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{etapas.map((status, index) => <li key={status} className={`rounded-lg p-3 text-center text-sm ${etapas.indexOf(pedido.status) >= index ? "bg-green-50 text-green-900" : "bg-sand text-muted"}`}>{index + 1}. {statusPedido[status]}</li>)}</ol>}
      </section>
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-semibold">Produtos e valores</h2><ul className="mt-4 divide-y divide-line">{pedido.itens.map((item, i) => <li key={i} className="py-4"><div className="flex justify-between gap-4"><span>{item.nome} × {item.quantidade}</span><span>{formatPrice(item.totalCentavos / 100)}</span></div>{pedido.pagoEm && pedido.status !== "cancelado" && <Link to={`/produto/${item.id}/feedbacks`} className="mt-2 inline-block text-sm text-terracotta underline">Avaliar produto</Link>}</li>)}</ul><p className="mt-4 text-sm">Frete: {formatPrice(pedido.freteCentavos / 100)} · Desconto: {formatPrice(pedido.descontoCentavos / 100)}</p><p className="mt-4 text-xl font-semibold">Total: {formatPrice(pedido.totalCentavos / 100)}</p></section>
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-semibold">Endereço do pedido</h2>{pedido.frete && <p className="mt-3 text-sm text-muted">Saída: {pedido.frete.origem.nome} · Frete nível {pedido.frete.nivel} · {pedido.frete.distanciaKm.toLocaleString("pt-BR")} km aproximados em linha reta.</p>}<p className="mt-3 text-sm">{pedido.enderecoEntrega.logradouro}, {pedido.enderecoEntrega.numero} {pedido.enderecoEntrega.complemento}<br />{pedido.enderecoEntrega.bairro} · {pedido.enderecoEntrega.cidade}/{pedido.enderecoEntrega.estado}<br />CEP {pedido.enderecoEntrega.cep}</p></section>
    </div>}
  </main>;
}
