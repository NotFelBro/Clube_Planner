import shippingRules from "../../../../shared/shippingRules.json";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router";
import { useStore } from "../../components/layout/StoreContext.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { listarDadosConta } from "../../services/authApi.js";
import { shopApi } from "../../services/shopApi.js";
import AddressForm from "../../components/account/AddressForm.jsx";
import { formatPrice } from "../../data/products.js";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { cart: sacola, products, clearCart, checkoutConfig } = useStore();
  const compraDireta = params.has("produto");
  const produtoId = Number(params.get("produto"));
  const quantidade = Number(params.get("quantidade") || 1);
  const produto = products.find(item => item.id === produtoId);
  const compraValida = produto && Number.isSafeInteger(quantidade) && quantidade >= 1 && quantidade <= 99;
  const cart = compraDireta ? (compraValida ? Array(quantidade).fill(produto) : []) : sacola;
  const cartSubtotal = cart.reduce((total, item) => total + item.price, 0);
  const originalSubtotal = cart.reduce((sum, item) => sum + Math.round((item.originalPrice ?? item.price) * 100), 0) / 100;
  const desconto = originalSubtotal - cartSubtotal;
  const voltarPara = compraDireta && produto ? `/produto/${produto.id}` : "/sacola";
  const { accessToken, autenticado, usuario } = useAuth();
  const [enderecos, setEnderecos] = useState([]);
  const [enderecoId, setEnderecoId] = useState("");
  const [novoEndereco, setNovoEndereco] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cepNovo, setCepNovo] = useState("");
  const [cupomFrete, setCupomFrete] = useState("");
  const itensCotacao = JSON.stringify([...new Set(cart.map(p => p.id))].map(id => ({ id, quantidade: cart.filter(p => p.id === id).length })));
  const [cotacao, setCotacao] = useState(null);
  const [tentativaFrete, setTentativaFrete] = useState(0);
  const cepEntrega = novoEndereco || !enderecoId ? cepNovo : enderecos.find((item) => item._id === enderecoId)?.cep || "";
  const cepValido = /^\d{8}$/.test(cepEntrega);
  const cotacaoAtual = cepValido && cotacao?.cep === cepEntrega && cotacao?.itens === itensCotacao && cotacao?.cupom === cupomFrete ? cotacao : null;
  const frete = cotacaoAtual?.frete;
  const calculandoFrete = cepValido && !cotacaoAtual;
  const totalCentavos = frete ? Math.round(cartSubtotal * 100) + frete.valorCentavos : null;

  useEffect(() => {
    if (!accessToken || !cepValido) return;
    let ativo = true;
    shopApi("/shipping-quote", accessToken, { cep: cepEntrega, itens: JSON.parse(itensCotacao), cupomFrete })
      .then((dados) => { if (ativo) setCotacao({ cep: cepEntrega, itens: itensCotacao, cupom: cupomFrete, frete: dados.frete }); })
      .catch((error) => { if (ativo) setCotacao({ cep: cepEntrega, itens: itensCotacao, cupom: cupomFrete, erro: error.message }); });
    return () => { ativo = false; };
  }, [accessToken, cepEntrega, cepValido, tentativaFrete, itensCotacao, cupomFrete]);
  useEffect(() => {
    let ativo = true;
    if (!accessToken) return;
    listarDadosConta("addresses", accessToken).then((dados) => {
      if (ativo) { setEnderecos(dados.enderecos); setEnderecoId(dados.enderecos.find((e) => e.principal)?._id || dados.enderecos[0]?._id || ""); }
    }).catch((error) => { if (ativo) setErro(error.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [accessToken]);
  const itens = [...new Set(cart.map((p) => p.id))].sort((a, b) => a - b).map((id) => ({ id, quantidade: cart.filter((p) => p.id === id).length }));
  const estoqueInsuficiente = itens.some(item => item.quantidade > (products.find(p => p.id === item.id)?.stock ?? 0));
  async function confirmar(event) {
    event.preventDefault();
    if (salvando || carregando || novoEndereco || !enderecoId || !frete || estoqueInsuficiente) return;
    setSalvando(true); setErro("");
    try {
      const assinatura = JSON.stringify({ itens, enderecoId, totalCentavos, frete: frete.valorCentavos, cupomFrete });
      const storageKey = `clube-checkout-${usuario.id}`;
      let tentativa;
      try { tentativa = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Nova tentativa. */ }
      if (tentativa?.assinatura !== assinatura) tentativa = { assinatura, chave: crypto.randomUUID() };
      sessionStorage.setItem(storageKey, JSON.stringify(tentativa));
      const { pedido } = await shopApi("/checkout", accessToken, { itens, enderecoId, chave: tentativa.chave, totalEsperadoCentavos: totalCentavos, freteEsperadoCentavos: frete.valorCentavos, cupomFrete });
      // O pedido já está persistido. O pagamento pode ser retomado pelos detalhes.
      if (!compraDireta) clearCart();
      sessionStorage.removeItem(storageKey);
      navigate(`/perfil/pedidos/${pedido.id}`);
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  }
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-10">
    <h1 className="font-display text-3xl font-semibold">Finalizar compra</h1>
    {!autenticado ? <div className="mt-6 rounded-xl bg-white p-6"><p>Entre na sua conta para salvar o pedido e escolher o endereço.</p><Link to="/" state={{ from: { pathname: "/checkout", search: location.search } }} className="mt-4 inline-block text-terracotta underline">Acessar minha conta</Link></div> : !cart.length ? <p className="mt-6">{compraDireta ? "Produto ou quantidade inválidos." : "Sua sacola está vazia."} <Link to="/loja" className="text-terracotta underline">Explorar produtos</Link></p> :
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Endereço de entrega</h2>
          {carregando && <p role="status" className="mt-4">Carregando endereços...</p>}
          <fieldset disabled={salvando} className="mt-4 space-y-3">
            <legend className="sr-only">Escolha um endereço</legend>
            {enderecos.map((endereco) => <label key={endereco._id} className="flex gap-3 rounded-xl border border-line p-4 text-sm">
              <input type="radio" name="endereco" required value={endereco._id} checked={!novoEndereco && enderecoId === endereco._id} onChange={() => { setEnderecoId(endereco._id); setNovoEndereco(false); setErro(""); }} />
              <span>{endereco.logradouro}, {endereco.numero}<br />{endereco.bairro} · {endereco.cidade}/{endereco.estado}<br />CEP {endereco.cep}</span>
            </label>)}
          </fieldset>
          {!carregando && !enderecos.length && <p className="mt-4 text-sm">Cadastre um endereço para continuar.</p>}
          {!carregando && <>
            {enderecos.length > 0 && <button type="button" disabled={salvando} onClick={() => { setNovoEndereco(!novoEndereco); setCepNovo(""); setErro(""); }} aria-expanded={novoEndereco} className="mt-4 text-sm font-semibold text-terracotta underline disabled:opacity-60">{novoEndereco ? "Usar endereço salvo" : "Entregar em outro endereço"}</button>}
            {(novoEndereco || !enderecos.length) && <div className="mt-5 border-t border-line pt-4">
              <h3 className="font-semibold">Cadastrar endereço de entrega</h3>
              <p className="mt-2 text-sm text-muted">Informe o CEP para preencher o endereço. Confira os dados e complete o número e o complemento.</p>
              <AddressForm onCepChange={setCepNovo} disabled={salvando} submitLabel="Salvar e usar este endereço" onSaved={(lista) => {
                const novo = lista.find((item) => !enderecos.some((anterior) => anterior._id === item._id));
                setEnderecos(lista);
                setEnderecoId(novo?._id || lista[lista.length - 1]?._id || "");
                setNovoEndereco(false);
                setErro("");
              }} />
            </div>}
          </>}
        </section>
        <form onSubmit={confirmar} className="min-w-0 self-start rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">Resumo da compra</h2>
          <ul className="mt-4 space-y-3 text-sm">{itens.map((item) => { const p = cart.find((p) => p.id === item.id); return <li key={item.id} className="flex justify-between gap-4"><span>{p.name} × {item.quantidade}</span><span>{formatPrice(p.price * item.quantidade)}</span></li>; })}</ul>
          <label className="mt-5 block text-sm font-semibold">Cupom de frete
            <select value={cupomFrete} disabled={salvando} onChange={e => setCupomFrete(e.target.value)} className="mt-2 block w-full rounded-lg border border-line bg-white p-3">
              <option value="">Sem cupom</option>
              {[1, 2, 3].filter(nivel => cart.some(p => p.shippingCouponLevel === nivel)).map(nivel => <option key={nivel} value={`FRETE${nivel}`}>FRETE{nivel} — frete grátis para nível {nivel}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted">Válido com produto participante e CEP do mesmo nível. Um cupom por pedido.</p>
          {frete?.cupom && <p role="status" className="mt-3 text-sm text-green-800">{frete.cupom} aplicado: frete grátis! Economia de {formatPrice(frete.descontoCentavos / 100)}.</p>}
          <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
            <p className="flex justify-between gap-3"><span>Subtotal dos produtos</span><span>{formatPrice(originalSubtotal)}</span></p>
            {desconto > 0 && <p className="flex justify-between gap-3"><span>Descontos</span><span>− {formatPrice(desconto)}</span></p>}
            <p className="flex justify-between gap-3"><span>Frete{frete ? ` · Nível ${frete.nivel}` : ""}</span><span>{frete ? formatPrice(frete.valorCentavos / 100) : calculandoFrete ? "Calculando..." : "A calcular"}</span></p>
            <p className="text-xs leading-5 text-muted">Saída: {shippingRules.origem.nome}. {frete ? `Distância aproximada: ${frete.distanciaKm.toLocaleString("pt-BR")} km em linha reta entre CEPs.` : "Informe o CEP de entrega para calcular."}</p>
            <ul className="space-y-1 text-xs text-muted" aria-label="Faixas de frete">
              {shippingRules.faixas.map((faixa, index) => <li key={faixa.nivel}>Nível {faixa.nivel}: {index === 0 ? `até ${faixa.limiteKm} km` : faixa.limiteKm === null ? `acima de ${shippingRules.faixas[index - 1].limiteKm} km` : `acima de ${shippingRules.faixas[index - 1].limiteKm} até ${faixa.limiteKm} km`} — {formatPrice(faixa.valorCentavos / 100)}</li>)}
            </ul>
            {frete && <button type="button" disabled={salvando} onClick={() => { setCotacao(null); setTentativaFrete((valor) => valor + 1); }} className="text-xs font-semibold text-terracotta underline disabled:opacity-60">Recalcular frete</button>}
            {calculandoFrete && <p role="status">Calculando frete pelo CEP...</p>}
            {cotacaoAtual?.erro && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-800"><p>{cotacaoAtual.erro}</p><button type="button" onClick={() => { setCotacao(null); setTentativaFrete((valor) => valor + 1); }} className="mt-2 font-semibold underline">Tentar calcular novamente</button></div>}
          </div>
          <p className="mt-5 border-t border-line pt-4 text-xl font-semibold">Total: {totalCentavos === null ? "A calcular" : formatPrice(totalCentavos / 100)}</p>
          <h3 className="mt-6 font-semibold">Pagamento</h3>
          <p className="mt-2 text-sm text-muted">Checkout Pro do Mercado Pago: o total inclui os produtos e o frete. Escolha o meio de pagamento disponível no Mercado Pago.</p>
          {!checkoutConfig?.habilitado && <p role="alert" className="mt-4 text-sm">Checkout indisponível. Verifique a conexão com o servidor.</p>}
          {estoqueInsuficiente && <p role="alert" className="mt-4 text-sm text-red-800">Alguns produtos não têm estoque suficiente. Atualize as quantidades na sacola antes de confirmar.</p>}
          {erro && <p role="alert" className="mt-4 text-sm text-red-800">{erro}</p>}
          <button disabled={salvando || carregando || novoEndereco || !enderecoId || !frete || estoqueInsuficiente || !checkoutConfig?.habilitado} className="mt-6 min-h-12 w-full rounded-xl bg-terracotta px-4 font-semibold text-white disabled:opacity-60">{salvando ? "Confirmando..." : "Criar pedido e continuar para pagamento"}</button>
        </form>
      </div>}
    <Link to={voltarPara} className="return-action return-action-strong mt-6">{compraDireta && produto ? "← Voltar ao produto" : "← Voltar à sacola"}</Link>
  </main>;
}
