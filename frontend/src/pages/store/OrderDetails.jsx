import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { shopApi } from "../../services/shopApi.js";
import { formatPrice } from "../../data/products.js";
import { statusPedido } from "../../data/orderStatus.js";

export default function OrderDetails() {
  const { id } = useParams();
  return <OrderContent key={id} id={id} />;
}
function OrderContent({ id }) {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const sincronizacaoPausada = useRef(false);
  useEffect(() => {
    let ativo = true;
    let executando = false;
    async function carregar() {
      if (executando || document.visibilityState === 'hidden') return;
      executando = true;
      try {
        const dados = await shopApi(`/orders/${id}`, accessToken);
        if (!ativo) return;
        setPedido(dados.pedido);
        const { checkoutUrl, status, pagamentoTipo, cancelamentoSolicitadoEm, pagamentoStatus } = dados.pedido;
        const aguardaPagamento = status === "aguardando_pagamento" && Boolean(checkoutUrl);
        const aguardaReembolso = cancelamentoSolicitadoEm && pagamentoStatus !== "reembolsado";
        if (!sincronizacaoPausada.current && pagamentoTipo === "mercado_pago" && (aguardaPagamento || aguardaReembolso)) {
          try {
            const atualizado = await shopApi(`/orders/${id}/sync`, accessToken, {});
            if (ativo) { setPedido(atualizado.pedido); setErro(""); }
          } catch (error) {
            if (!ativo) return;
            if (error.status === 409) sincronizacaoPausada.current = true;
            setErro(error.message);
          }
        }
      } catch (error) { if (ativo) setErro(error.message); }
      finally { executando = false; }
    }
    void carregar();
    const timer = setInterval(carregar, 15000);
    window.addEventListener("focus", carregar);
    document.addEventListener("visibilitychange", carregar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", carregar); document.removeEventListener("visibilitychange", carregar); };
  }, [id, accessToken]);
  async function acao(tipo) {
    if (ocupado) return;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const janela = tipo === "payment" && local ? window.open("about:blank", "_blank") : null;
    if (janela) janela.opener = null;
    setOcupado(true); setErro("");
    try {
      const dados = await shopApi(`/orders/${id}/${tipo}`, accessToken, {});
      if (tipo === "sync") sincronizacaoPausada.current = false;
      if (tipo === "cancel" && dados.pedido.status === "cancelado") {
        navigate("/perfil#pedidos", {
          replace: true,
          state: { pedidoCancelado: dados.pedido.id },
        });
        return;
      }
      setPedido(dados.pedido);
      setConfirmarCancelamento(false);
      if (tipo === "payment" && dados.pedido.checkoutUrl) {
        if (janela) janela.location.replace(dados.pedido.checkoutUrl);
        else window.location.assign(dados.pedido.checkoutUrl);
      }
    } catch (error) { if (janela) janela.close(); setErro(error.message); }
    finally { setOcupado(false); }
  }
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-10">
    <Link to="/perfil" className="return-action">← Visão geral</Link>
    <h1 className="mt-5 font-display text-3xl font-semibold">Detalhes do pedido</h1>
    {erro && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
    {!pedido && !erro && <p role="status" className="mt-6">Carregando pedido...</p>}
    {pedido && <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Pedido #{pedido.id.slice(-8).toUpperCase()}</h2><p>{statusPedido[pedido.status]}</p></div>
        <p className="mt-2 text-sm text-muted">{new Date(pedido.criadoEm).toLocaleString("pt-BR")}</p>
        <p className="mt-4 text-sm">{pedido.pagamentoTipo === "gratuito" ? "Pedido gratuito confirmado. Pagamento dispensado; nenhuma cobrança foi realizada." : `Mercado Pago · ${pedido.pagamentoStatus || "Aguardando pagamento"}`}</p>
        {pedido.pagamentoTipo === "mercado_pago" && pedido.status === "aguardando_pagamento" && !pedido.cancelamentoSolicitadoEm && <div className="mt-5 flex flex-wrap gap-3"><button disabled={ocupado} onClick={() => acao("payment")} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{ocupado ? "Aguarde..." : "Pagar no Mercado Pago"}</button>{pedido.checkoutUrl && <button disabled={ocupado} onClick={() => acao("sync")} className="rounded-xl border border-line px-5 py-3 text-sm">Atualizar pagamento</button>}</div>}
        {pedido.cancelamentoSolicitadoEm && pedido.status !== "cancelado" && <p role="status" className="mt-4 text-sm">Cancelamento solicitado. Estamos aguardando a confirmação do cancelamento ou reembolso. <button disabled={ocupado} onClick={() => acao("cancel")} className="underline">Tentar novamente</button></p>}
        {pedido.status === "cancelado" && <p role="status" className="mt-4 text-sm">{pedido.pagamentoStatus === "reembolsado" ? "Pedido cancelado e reembolso integral confirmado pelo Mercado Pago, incluindo o frete. O prazo para o valor aparecer depende do meio de pagamento." : "Pedido cancelado. Se houver confirmação tardia de pagamento, o sistema solicitará o reembolso integral."}</p>}
        {["aguardando_pagamento", "pago", "em_preparacao", "enviado"].includes(pedido.status) && !pedido.cancelamentoSolicitadoEm && <div className="mt-5 border-t border-line pt-4">
          {!confirmarCancelamento ? <button disabled={ocupado} onClick={() => setConfirmarCancelamento(true)} className="text-sm font-semibold text-red-800 underline">Cancelar pedido{pedido.pagoEm && pedido.totalCentavos > 0 ? " e solicitar reembolso" : ""}</button> : <div>
            <p className="text-sm">Deseja cancelar o pedido inteiro? Se o pagamento já foi aprovado, será solicitado o reembolso integral, incluindo o frete. Esta opção está disponível até o pedido ser marcado como entregue.</p>
            <div className="mt-3 flex flex-wrap gap-3"><button disabled={ocupado} onClick={() => acao("cancel")} className="rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{ocupado ? "Processando..." : "Confirmar cancelamento"}</button><button disabled={ocupado} onClick={() => setConfirmarCancelamento(false)} className="rounded-xl border border-line px-4 py-3 text-sm">Manter pedido</button></div>
          </div>}
        </div>}
      </section>
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-semibold">Produtos e valores</h2><ul className="mt-4 divide-y divide-line">{pedido.itens.map((item, i) => <li key={i} className="py-4"><div className="flex justify-between gap-4"><span>{item.nome} × {item.quantidade}</span><span>{formatPrice(item.totalCentavos / 100)}</span></div>{pedido.pagoEm && pedido.status !== "cancelado" && <Link to={`/produto/${item.id}/feedbacks`} className="mt-2 inline-block text-sm text-terracotta underline">Avaliar produto</Link>}</li>)}</ul><p className="mt-4 text-sm">Frete: {formatPrice(pedido.freteCentavos / 100)} · Desconto: {formatPrice(pedido.descontoCentavos / 100)}</p><p className="mt-4 text-xl font-semibold">Total: {formatPrice(pedido.totalCentavos / 100)}</p></section>
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-semibold">Endereço do pedido</h2>{pedido.frete && <p className="mt-3 text-sm text-muted">Saída: {pedido.frete.origem.nome} · Frete nível {pedido.frete.nivel} · {pedido.frete.distanciaKm.toLocaleString("pt-BR")} km aproximados em linha reta.</p>}<p className="mt-3 text-sm">{pedido.enderecoEntrega.logradouro}, {pedido.enderecoEntrega.numero} {pedido.enderecoEntrega.complemento}<br />{pedido.enderecoEntrega.bairro} · {pedido.enderecoEntrega.cidade}/{pedido.enderecoEntrega.estado}<br />CEP {pedido.enderecoEntrega.cep}</p></section>
    </div>}
  </main>;
}
