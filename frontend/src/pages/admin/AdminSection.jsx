import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { adminApi, notificarCatalogo } from '../../services/adminApi.js';
import { statusPedido } from '../../data/orderStatus.js';
const money = cents => cents == null ? 'Não informado' : (cents / 100).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
const shortId = value => value?.slice(-8).toUpperCase() || '—';
const button = 'min-h-10 rounded-lg bg-slatebrand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'min-h-10 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
const input = 'mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm';
const names = {
  dashboard: 'Visão geral da loja',
  pedidos: 'Gerenciamento de pedidos',
  vendas: 'Pagamentos e faturamento',
  clientes: 'Gerenciamento de clientes',
  configuracoes: 'Configurações da loja'
};
function useAdminData(path) {
  const {
    accessToken, renovar
  } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true,
      pending = false;
    const controller = new AbortController();
    const carregar = async () => {
      if (pending) return;
      pending = true;
      try {
        const resultado = await adminApi(path, accessToken, { signal: controller.signal });
        if (active) {
          setData(resultado);
          setError('');
        }
      } catch (e) {
        if (!active || e.name === 'AbortError') return;
        if (e.status === 401) {
          try { await renovar(); } catch { if (active) setError('Sua sessão expirou. Entre novamente para continuar.'); }
        } else if (active) setError(e.message);
      } finally {
        pending = false;
      }
    };
    void carregar();
    const timer = setInterval(() => {
      if (!document.hidden) void carregar();
    }, 30000);
    window.addEventListener('focus', carregar);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', carregar);
    };
  }, [path, accessToken, revision, renovar]);
  return {
    data,
    error,
    refresh: () => setRevision(value => value + 1)
  };
}
function Panel({
  title,
  children
}) {
  return <section className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6">{title && <h3 className="mb-4 font-display text-lg font-bold">{title}</h3>}{children}</section>;
}
function Table({
  headers,
  children
}) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-sand/50"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap p-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></div>;
}
function Empty({
  children = 'Nenhum registro encontrado neste período.'
}) {
  return <p className="rounded-xl bg-sand/50 p-5 text-sm text-muted">{children}</p>;
}
function Pagination({
  data,
  page,
  setPage
}) {
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{data.total} registro(s) · Página {page} de {Math.max(1, Math.ceil(data.total / data.limite))}</p><div className="flex gap-2"><button className={secondary} disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><button className={secondary} disabled={page * data.limite >= data.total} onClick={() => setPage(page + 1)}>Próxima</button></div></div>;
}
function Chart({
  series
}) {
  if (!series.length) return <Empty>Nenhum recebimento confirmado neste período.</Empty>;
  const max = Math.max(1, ...series.map(p => p.brutoCentavos));
  const width = 700 / series.length;
  return <div><svg viewBox="0 0 760 245" role="img" aria-label="Recebimentos brutos confirmados por dia" className="w-full"><line x1="40" x2="740" y1="205" y2="205" stroke="#e5e1d5" />{[0, 0.5, 1].map(v => <g key={v}><line x1="40" x2="740" y1={205 - v * 165} y2={205 - v * 165} stroke="#e5e1d5" strokeDasharray="4 4" /><text x="40" y={197 - v * 165} fontSize="11" fill="#81849a">{money(Math.round(max * v))}</text></g>)}{series.map((p, i) => <rect key={p._id} x={42 + i * width} y={205 - p.brutoCentavos / max * 165} width={Math.max(1, width - 4)} height={Math.max(1, p.brutoCentavos / max * 165)} rx="3" fill="#e47c62"><title>{p._id}: {money(p.brutoCentavos)} · {p.transacoes} pagamento(s)</title></rect>)}<text x="40" y="230" fontSize="11" fill="#81849a">{series[0]._id}</text><text x="740" y="230" textAnchor="end" fontSize="11" fill="#81849a">{series.at(-1)._id}</text></svg><p className="text-xs text-muted">Valores capturados pelo provedor, por data de aprovação. Até 366 datas recentes com recebimentos, no horário de São Paulo.</p></div>;
}
function Metrics({
  data
}) {
  const i = data.indicadores;
  const cards = [['Recebimentos brutos', money(i.faturamentoBrutoCentavos)], ['Reembolsos confirmados', money(i.reembolsosCentavos)], ['Receita após reembolsos', money(i.receitaAposReembolsosCentavos)], ['Pedidos recebidos', i.totalPedidos], ['Pedidos pagos', i.pedidosPagos], ['Aguardando pagamento', i.pedidosPendentes], ['Ticket médio dos pedidos pagos', money(i.ticketMedioCentavos)], ['Clientes cadastrados no período', i.clientes], ['Clientes com mais de uma compra', i.clientesRecorrentes], ['Pedidos entregues', i.pedidosEntregues], ['Conversão de pedidos', `${i.conversaoPedidos}%`], ['Taxas informadas pelo provedor', money(i.taxasCentavos)]];
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-3 break-words font-display text-2xl font-bold">{value}</p></div>)}</div><p className="text-xs leading-5 text-muted">Receita após reembolsos não representa lucro: custos e tributos não são calculados. Conversão considera pedidos criados e pagos; visitas ao site não são monitoradas. Taxas ficam indisponíveis quando faltam dados do provedor.</p></>;
}
function exportReport(data) {
  const linhas = [['Indicador', 'Valor'], ...Object.entries(data.indicadores), [], ['Data', 'Recebimentos em centavos', 'Pagamentos'], ...data.evolucao.map(p => [p._id, p.brutoCentavos, p.transacoes]), [], ['Produto', 'Quantidade', 'Vendas em centavos'], ...data.maisVendidos.map(p => [p.nome, p.quantidade, p.totalCentavos])];
  const csv = '\ufeff' + linhas.map(l => l.map(v => {
    let s = v == null ? 'Não informado' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {
    type: 'text/csv;charset=utf-8;'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clube-planner-relatorio.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Overview({ data }) {
  return <div className="space-y-6"><Metrics data={data} /><Panel title="Evolução dos recebimentos"><Chart series={data.evolucao} /></Panel><div className="grid gap-6 xl:grid-cols-2"><Panel title="Produtos mais vendidos">{data.maisVendidos.length ? <Table headers={['Produto', 'Unidades', 'Vendas']}>{data.maisVendidos.map(p => <tr key={p._id}><td className="p-3">{p.nome}</td><td className="p-3">{p.quantidade}</td><td className="whitespace-nowrap p-3">{money(p.totalCentavos)}</td></tr>)}</Table> : <Empty />}</Panel><Panel title="Situação dos pedidos">{data.porStatus.length ? <ul className="space-y-3">{data.porStatus.map(p => <li key={p._id} className="flex justify-between rounded-xl bg-sand/50 p-3 text-sm"><span>{statusPedido[p._id] || p._id}</span><strong>{p.quantidade}</strong></li>)}</ul> : <Empty />}</Panel></div><Panel title="Estoque crítico">{data.estoqueCritico.length ? <Table headers={['Produto', 'SKU', 'Disponível']}>{data.estoqueCritico.map(p => <tr key={p.sku}><td className="p-3">{p.nome}</td><td className="p-3">{p.sku}</td><td className="p-3 font-semibold text-terracotta">{p.disponivel}</td></tr>)}</Table> : <Empty>Nenhuma variação abaixo do limite de estoque configurado.</Empty>}<Link to="/admin/produtos" className="mt-4 inline-block text-sm font-semibold text-terracotta underline">Gerenciar produtos e estoque</Link></Panel><button className={button} onClick={() => exportReport(data)}>Exportar relatório CSV</button></div>;
}
function OrderDetail({
  id,
  onClose,
  onUpdated
}) {
  const {
    accessToken
  } = useAuth();
  const {
    data,
    error,
    refresh
  } = useAdminData(`/orders/${id}`);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [failure, setFailure] = useState(''),
    [tracking, setTracking] = useState('');
  const pending = useRef(false);
  async function action(path, method = 'POST', body = {}) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure('');
    setNotice('');
    try {
      await adminApi(`/orders/${id}/${path}`, accessToken, {
        method,
        body
      });
      setNotice('Pedido atualizado.');
      refresh();
      onUpdated();
    } catch (e) {
      setFailure(e.message);
      refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const p = data?.pedido,
    next = p && {
      pago: 'em_preparacao',
      em_preparacao: 'enviado',
      enviado: 'entregue'
    }[p.status];
  return <Panel title={`Pedido #${shortId(id)}`}><button className={secondary} onClick={onClose}>Fechar detalhes</button>{(error || failure) && <p role="alert" className="mt-4 text-sm text-red-800">{failure || error}</p>}{notice && <p role="status" className="mt-4 rounded-lg bg-softsage p-3 text-sm">{notice}</p>}{p ? <div className="mt-5 space-y-5"><div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>Cliente:</strong> {p.cliente?.nome || 'Cadastro indisponível'}<br />{p.cliente?.email}</p><p><strong>Situação:</strong> {statusPedido[p.status]}<br />{p.ambienteTeste ? 'Pedido de teste' : 'Pedido de produção'} · {date(p.criadoEm)}</p><p>Produtos: {money(p.subtotalCentavos)}<br />Descontos: {money(p.descontoCentavos)}<br />Frete: {money(p.freteCentavos)}<br /><strong>Total: {money(p.totalCentavos)}</strong></p><p><strong>Entrega:</strong><br />{p.enderecoEntrega.logradouro}, {p.enderecoEntrega.numero}<br />{p.enderecoEntrega.bairro} · {p.enderecoEntrega.cidade}/{p.enderecoEntrega.estado}<br />CEP {p.enderecoEntrega.cep}</p></div><Table headers={['Produto', 'Quantidade', 'Total']}>{p.itens.map((i, n) => <tr key={n}><td className="p-3">{i.nome}</td><td className="p-3">{i.quantidade}</td><td className="p-3">{money(i.totalCentavos)}</td></tr>)}</Table><div className="flex flex-wrap gap-3">{p.pagamentoTipo === 'mercado_pago' && <button className={secondary} disabled={busy} onClick={() => action('sync')}>Consultar pagamento no Mercado Pago</button>}{p.ambienteTeste && ['aguardando_pagamento', 'pago', 'em_preparacao', 'enviado'].includes(p.status) && <button className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-800 disabled:opacity-50" disabled={busy} onClick={() => {
          if (window.confirm('Cancelar o pedido inteiro? Pagamentos aprovados serão reembolsados integralmente.')) void action('cancel');
        }}>Cancelar pedido / reembolsar</button>}</div>{next && !p.cancelamentoSolicitadoEm && <div className="rounded-xl bg-sand/60 p-4"><label className="text-sm">Código de rastreio (opcional)<input className={input} maxLength={100} value={tracking} placeholder={p.codigoRastreio || 'Código fornecido pela transportadora'} onChange={e => setTracking(e.target.value)} /></label><button disabled={busy} className={`${button} mt-3`} onClick={() => action('status', 'PATCH', {
          status: next,
          codigoRastreio: tracking || p.codigoRastreio
        })}>Marcar como {statusPedido[next].toLowerCase()}</button></div>}{p.cancelamentoSolicitadoEm && p.status !== 'cancelado' && <p className="text-sm text-terracotta">Cancelamento em processamento. Consulte novamente para confirmar o reembolso.</p>}{p.estoqueRetornoPendente && <div className="rounded-lg bg-softsage p-4 text-sm"><p>O produto já havia sido enviado. O estoque aguarda a devolução física.</p><button className={`${secondary} mt-3`} disabled={busy} onClick={() => {
          if (window.confirm('Confirma que todos os produtos deste pedido voltaram fisicamente para a loja?')) void action('stock-return');
        }}>Confirmar recebimento da devolução</button></div>}{p.codigoRastreio && <p className="text-sm">Rastreio: <strong>{p.codigoRastreio}</strong></p>}<h4 className="font-semibold">Pagamentos do pedido</h4><PaymentsTable items={data.pagamentos} /><h4 className="font-semibold">Histórico do pedido</h4>{data.historico.length ? <ul className="space-y-2 text-sm">{data.historico.map(e => <li key={e._id} className="rounded-lg bg-sand/50 p-3">{date(e.createdAt)} · {e.descricao || e.acao}</li>)}</ul> : <Empty>Nenhum evento registrado para este pedido.</Empty>}</div> : !error && <p role="status" className="mt-4 text-sm">Carregando detalhes...</p>}</Panel>;
}
function Orders({
  data,
  page,
  setPage,
  refresh
}) {
  const [urlParams] = useSearchParams();
  const [selected, setSelected] = useState(() => urlParams.get('pedido'));
  return <div className="space-y-6"><Panel title="Pedidos recebidos">{data.pedidos.length ? <Table headers={['Pedido / data', 'Cliente', 'Produtos', 'Total', 'Situação', 'Ação']}>{data.pedidos.map(p => <tr key={p.id}><td className="p-3">#{shortId(p.id)}<br /><span className="text-xs text-muted">{date(p.criadoEm)}{p.ambienteTeste && ' · Teste'}</span></td><td className="p-3">{p.cliente?.nome}<br /><span className="text-xs text-muted">{p.cliente?.email}</span></td><td className="max-w-xs p-3">{p.itens.map(i => `${i.nome} × ${i.quantidade}`).join(', ')}</td><td className="whitespace-nowrap p-3">{money(p.totalCentavos)}</td><td className="p-3">{statusPedido[p.status]}{p.cancelamentoSolicitadoEm && p.status !== 'cancelado' && <span className="block text-xs text-terracotta">Cancelamento solicitado</span>}</td><td className="p-3"><button className={secondary} onClick={() => setSelected(p.id)}>Detalhes</button></td></tr>)}</Table> : <Empty />}<Pagination data={data} page={page} setPage={setPage} /></Panel>{selected && <OrderDetail key={selected} id={selected} onClose={() => setSelected(null)} onUpdated={refresh} />}</div>;
}
function PaymentsTable({
  items
}) {
  return items.length ? <Table headers={['Referência', 'Pedido', 'Método', 'Situação', 'Capturado', 'Reembolsado', 'Taxas', 'Confirmação']}>{items.map(p => <tr key={p.id}><td className="p-3">{p.referencia || shortId(p.id)}</td><td className="p-3"><Link to={`/admin/pedidos?pedido=${p.pedidoId}`} className="text-terracotta underline">#{shortId(p.pedidoId)}</Link></td><td className="p-3">{p.metodo}</td><td className="p-3">{p.status}</td><td className="whitespace-nowrap p-3">{money(p.capturadoCentavos)}</td><td className="whitespace-nowrap p-3">{money(p.reembolsadoCentavos)}</td><td className="whitespace-nowrap p-3">{money(p.taxasCentavos)}</td><td className="p-3">{date(p.aprovadoEm)}</td></tr>)}</Table> : <Empty>Nenhuma transação registrada pelo provedor. Consulte os pedidos aguardando pagamento na seção Pedidos.</Empty>;
}
function Customers({
  data,
  page,
  setPage,
  refresh
}) {
  const {
    accessToken
  } = useAuth();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function alterar(c) {
    if (busy || !window.confirm(`${c.ativo ? 'Desativar' : 'Ativar'} a conta de ${c.nome}?`)) return;
    setBusy(true);
    setError('');
    try {
      await adminApi(`/customers/${c.id}`, accessToken, {
        method: 'PATCH',
        body: {
          ativo: !c.ativo
        }
      });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <Panel title="Clientes da loja">{error && <p role="alert" className="mb-4 text-red-800">{error}</p>}{data.clientes.length ? <Table headers={['Cliente', 'Cadastro', 'Conta', 'Pedidos', 'Compras confirmadas', 'Último pedido', 'Ações']}>{data.clientes.map(c => <tr key={c.id}><td className="p-3 font-semibold">{c.nome}<span className="block text-xs font-normal text-muted">{c.email}</span><span className="block text-xs font-normal text-muted">CPF: {c.cpf ? c.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : 'Não informado'}</span></td><td className="p-3">{date(c.criadoEm)}</td><td className="p-3">{c.ativo ? 'Ativa' : 'Inativa'}<span className="block text-xs text-muted">{c.emailVerificado ? 'E-mail verificado' : 'Verificação pendente'}</span></td><td className="p-3">{c.totalPedidos}</td><td className="p-3">{c.comprasConfirmadas} · {money(c.totalCompradoCentavos)}</td><td className="p-3">{date(c.ultimaCompra)}</td><td className="p-3"><Link to={`/admin/pedidos?cliente=${encodeURIComponent(c.email)}`} className="mb-2 block text-terracotta underline">Ver pedidos</Link><button disabled={busy} className={secondary} onClick={() => alterar(c)}>{c.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>)}</Table> : <Empty />}<Pagination data={data} page={page} setPage={setPage} /><p className="mt-4 text-xs text-muted">Contas administrativas não são alteradas nesta seção. Desativar uma conta encerra suas sessões.</p></Panel>;
}
function Settings({
  data,
  refresh
}) {
  const {
    accessToken
  } = useAuth();
  const [form, setForm] = useState(data.loja),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function recarregarConfiguracoes() {
    if (busy) return;
    setBusy(true); setError('');
    try { const resultado = await adminApi('/settings', accessToken); setForm(resultado.loja); setMessage('Versão atual carregada. Confira os dados antes de salvar.'); refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function salvar(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const resultado = await adminApi('/settings', accessToken, {
        method: 'PUT',
        body: {
          ...form,
          estoqueCritico: Number(form.estoqueCritico)
        }
      });
      setForm(resultado.loja);
      setMessage('Configurações salvas e publicadas na loja.');
      notificarCatalogo();
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="grid gap-6 xl:grid-cols-2"><Panel title="Informações da loja"><form onSubmit={salvar} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Nome da loja<input required maxLength={100} className={input} value={form.nome} onChange={e => setForm({
              ...form,
              nome: e.target.value
            })} /></label><label className="block text-sm">E-mail de atendimento<input type="email" maxLength={254} className={input} value={form.emailAtendimento} onChange={e => setForm({
              ...form,
              emailAtendimento: e.target.value
            })} /></label><label className="block text-sm">Mensagem no topo da vitrine<input maxLength={200} className={input} value={form.mensagemTopo} onChange={e => setForm({
              ...form,
              mensagemTopo: e.target.value
            })} /></label><label className="block text-sm">Alerta de estoque abaixo ou igual a<input required type="number" min="0" max="10000" step="1" className={input} value={form.estoqueCritico} onChange={e => setForm({
              ...form,
              estoqueCritico: e.target.value
            })} /></label><div className="flex flex-wrap gap-3"><button className={button}>Salvar configurações</button><button type="button" className={secondary} onClick={recarregarConfiguracoes}>Carregar versão atual</button></div></fieldset></form>{message && <p role="status" className="mt-4 text-sm text-green-800">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}</Panel><Panel title="Integrações e entrega"><div className="space-y-4 text-sm"><p><strong>Pagamento:</strong> Mercado Pago · {data.pagamento.ambienteTeste ? 'Sandbox / teste' : 'Produção'}</p><p>Credenciais: {data.pagamento.credenciaisConfiguradas ? 'Configuradas no servidor' : 'Não configuradas'}</p><p>Webhook: {data.pagamento.webhookConfigurado ? 'Configurado' : 'Não configurado; use consulta manual em desenvolvimento'}</p><p><strong>Origem de entrega:</strong> {data.frete.origem.nome}<br />CEP {data.frete.origem.cep}</p><ul className="space-y-2">{data.frete.faixas.map(f => <li key={f.nivel}>Frete nível {f.nivel}: {money(f.valorCentavos)} · {f.limiteKm ? `até ${f.limiteKm} km` : 'acima de 30 km'}</li>)}</ul><p className="rounded-lg bg-softsage p-3 text-xs leading-5">Credenciais, segredos e permissões não são editados nem expostos nesta tela. O ambiente de teste não é convertido em produção pelo painel.</p><h4 className="font-semibold">Últimas alterações</h4>{data.historico?.length ? <ul className="space-y-2 text-xs">{data.historico.map(e => <li key={e._id}>{date(e.createdAt)} · {e.descricao}</li>)}</ul> : <p className="text-xs text-muted">Nenhuma alteração registrada.</p>}</div></Panel></div>;
}
function Content({
  section,
  params,
  page,
  setPage
}) {
  const endpoints = {
    dashboard: '/overview',
    pedidos: '/orders',
    vendas: '/payments',
    clientes: '/customers',
    configuracoes: '/settings'
  };
  const {
    data,
    error,
    refresh
  } = useAdminData(endpoints[section] + (section === 'configuracoes' ? '' : `?${new URLSearchParams({
    ...params,
    pagina: page
  })}`));
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">Atualização automática a cada 30 segundos</span><button className={secondary} onClick={refresh}>Atualizar dados</button></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} <button onClick={refresh} className="underline">Tentar novamente</button></p>}{!data && !error && <p role="status" className="rounded-xl bg-white p-6">Carregando dados da loja...</p>}{data && <>{section === 'dashboard' && <Overview data={data} />}{section === 'pedidos' && <Orders data={data} page={page} setPage={setPage} refresh={refresh} />}{section === 'vendas' && <Panel title="Transações registradas"><PaymentsTable items={data.pagamentos} /><Pagination data={data} page={page} setPage={setPage} /><p className="mt-4 text-xs text-muted">Consulte o pedido na seção Pedidos para reconciliar seu pagamento no Mercado Pago.</p></Panel>}{section === 'clientes' && <Customers data={data} page={page} setPage={setPage} refresh={refresh} />}{section === 'configuracoes' && <Settings data={data} refresh={refresh} />}</>}</div>;
}
function Workspace({
  section
}) {
  const [urlParams] = useSearchParams();
  const buscaInicial = section === 'pedidos' ? urlParams.get('cliente') || '' : '';
  const [draft, setDraft] = useState({
      ambiente: 'todos',
      de: '',
      ate: '',
      busca: buscaInicial,
      status: ''
    }),
    [params, setParams] = useState({
      ambiente: 'todos',
      ...(buscaInicial ? {
        busca: buscaInicial
      } : {})
    }),
    [page, setPage] = useState(1);
  const statuses = section === 'pedidos' ? Object.entries(statusPedido) : section === 'vendas' ? ['criado', 'pendente', 'em_processamento', 'aprovado', 'recusado', 'cancelado', 'reembolsado'].map(s => [s, s]) : [];
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Clube Planner / Administração</p><h2 className="mt-2 font-display text-2xl font-bold">{names[section] || 'Administração'}</h2><p className="mt-2 text-sm text-muted">Dados conectados ao backend da loja. Pedidos de teste são identificados nos registros.</p></header>{section !== 'configuracoes' && <Panel><form onSubmit={e => {
        e.preventDefault();
        setParams(Object.fromEntries(Object.entries(draft).filter(([, v]) => v)));
        setPage(1);
      }} className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-6"><label className="text-xs font-semibold">Ambiente<select className={input} value={draft.ambiente} onChange={e => setDraft({
            ...draft,
            ambiente: e.target.value
          })}><option value="todos">Todos (inclui testes)</option><option value="teste">Somente testes</option><option value="producao">Somente produção</option></select></label><label className="text-xs font-semibold">De<input type="date" className={input} value={draft.de} onChange={e => setDraft({
            ...draft,
            de: e.target.value
          })} required={Boolean(draft.ate)} /></label><label className="text-xs font-semibold">Até<input type="date" className={input} value={draft.ate} onChange={e => setDraft({
            ...draft,
            ate: e.target.value
          })} required={Boolean(draft.de)} /></label>{['pedidos', 'clientes'].includes(section) && <label className="text-xs font-semibold">Buscar<input maxLength={100} className={input} placeholder="Nome, e-mail ou pedido" value={draft.busca} onChange={e => setDraft({
            ...draft,
            busca: e.target.value
          })} /></label>}{statuses.length > 0 && <label className="text-xs font-semibold">Situação<select className={input} value={draft.status} onChange={e => setDraft({
            ...draft,
            status: e.target.value
          })}><option value="">Todas</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<button className={button}>Aplicar filtros</button></form></Panel>}<Content key={JSON.stringify(params) + page} section={section} params={params} page={page} setPage={setPage} /></div>;
}
export default function AdminSection({
  section = 'dashboard'
}) {
  const {
    section: routeSection
  } = useParams();
  const context = useOutletContext();
  if (context?.preview) return <Panel title="Painel administrativo"><p className="text-sm text-muted">Entre com uma conta de administrador para consultar e gerenciar os dados reais da loja.</p><Link to="/admin" className="mt-4 inline-block text-terracotta underline">Acessar painel protegido</Link></Panel>;
  if (!names[routeSection || section]) return <Panel title="Seção não encontrada"><Link to="/admin" className="text-terracotta underline">Voltar ao dashboard</Link></Panel>;
  return <Workspace key={routeSection || section} section={routeSection || section} />;
}
