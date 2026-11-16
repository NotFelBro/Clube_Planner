import { adminApi, notificarCatalogo } from '../../services/adminApi.js';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

const input = 'mt-1 w-full rounded-lg border border-[#e5e1d5] bg-white px-3 py-2';
const button = 'rounded-lg bg-[#3d415f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const blankVariant = () => ({ sku: '', atributosTexto: '', preco: '', precoOriginal: '', estoqueDisponivel: 0, ativo: true });
const blankProduct = () => ({ nome: '', slug: '', descricao: '', categoriaId: '', imagensTexto: '', ativo: true, shippingCouponLevel: null, variacoes: [blankVariant()] });
const blankCategory = () => ({ nome: '', slug: '', descricao: '', ativo: true });
const slugify = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function Field({ label, children }) { return <label className="block text-sm font-semibold">{label}{children}</label>; }

export default function ProductCatalog({ categoriesOnly = false }) {
  const { accessToken, renovar } = useAuth();
  const [data, setData] = useState({ produtos: [], categorias: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const enviando = useRef(false);
  async function api(path, method = 'GET', body) {
    try { return await adminApi(path, accessToken, { method, body }); }
    catch (error) {
      if (error.status === 401 && method === 'GET') { const token = await renovar(); if (token) return adminApi(path, token); }
      throw error;
    }
  }
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    adminApi('/catalog', accessToken, { signal: controller.signal })
      .then(result => { if (active) setData(result); })
      .catch(async e => { if (!active || e.name === 'AbortError') return; if (e.status === 401) { try { await renovar(); } catch { if (active) setError('Sua sessão expirou. Entre novamente.'); } } else if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [accessToken, renovar]);
  async function reloadCatalog() {
    if (saving) return;
    try { setData(await api('/catalog')); setError(''); setNotice('Catálogo atualizado. Para editar a versão atual, feche e reabra o cadastro.'); }
    catch (error) { setError(error.message); }
  }
  function edit(product) {
    setNotice(''); setError('');
    setForm({ ...product, imagensTexto: product.imagens.join('\n'), variacoes: product.variacoes.map(v => ({ ...v, preco: (v.precoCentavos / 100).toFixed(2), precoOriginal: v.precoOriginalCentavos == null ? '' : (v.precoOriginalCentavos / 100).toFixed(2), atributosTexto: Object.entries(v.atributos).map(([k, value]) => `${k}: ${value}`).join('\n') })) });
  }
  function variant(index, key, value) { setForm(current => ({ ...current, variacoes: current.variacoes.map((v, i) => i === index ? { ...v, [key]: value } : v) })); }
  async function save(event, isCategory) {
    event.preventDefault(); if (enviando.current) return; enviando.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const current = isCategory ? category : form;
      let body = { ...current };
      if (!isCategory) body = { ...body, imagens: form.imagensTexto.split('\n').map(s => s.trim()).filter(Boolean), variacoes: form.variacoes.map(v => {
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(String(v.preco))) throw new Error('Informe um preço válido com até duas casas decimais.');
        const atributos = Object.create(null);
        for (const line of v.atributosTexto.split('\n').filter(s => s.trim())) {
          const colon = line.indexOf(':');
          const key = line.slice(0, colon).trim();
          const value = line.slice(colon + 1).trim();
          if (colon < 1 || !value || Object.hasOwn(atributos, key)) throw new Error('Use um atributo por linha: Cor: Rosa. Não repita atributos.');
          atributos[key] = value;
        }
        if (v.precoOriginal !== '' && !/^\d+(?:[.,]\d{1,2})?$/.test(String(v.precoOriginal))) throw new Error('Informe um preço anterior válido.');
        return { ...v, precoOriginalCentavos: v.precoOriginal === '' ? null : Math.round(Number(String(v.precoOriginal).replace(',', '.')) * 100), precoCentavos: Math.round(Number(String(v.preco).replace(',', '.')) * 100), estoqueDisponivel: Number(v.estoqueDisponivel), atributos };
      }) };
      const path = isCategory ? '/categories' : '/products';
      await api(`${path}${current._id ? `/${current._id}` : ''}`, current._id ? 'PUT' : 'POST', body);
      notificarCatalogo();
      if (isCategory) setCategory(null); else setForm(null);
      setNotice(isCategory ? 'Categoria salva.' : 'Produto salvo.');
      try { setData(await api('/catalog')); }
      catch { setError('O cadastro foi salvo, mas a lista não pôde ser atualizada. Recarregue os dados; não é necessário cadastrar novamente.'); }
    } catch (e) { setError(e.message); } finally { enviando.current = false; setSaving(false); }
  }
  const products = data.produtos.filter(p => (!filter || p.categoriaId === filter) && `${p.nome} ${p.variacoes.map(v => v.sku).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold">{categoriesOnly ? 'Categorias' : 'Cadastro de produtos'}</h2><p className="mt-2 text-sm text-[#81849a]">{categoriesOnly ? 'Organize as categorias do catálogo.' : 'Catálogo integrado à vitrine. Gerencie imagens, preços e estoque de cada variação.'}</p></div><div className="flex flex-wrap gap-3"><button className={button} disabled={saving} onClick={reloadCatalog}>Atualizar catálogo</button><button className={button} onClick={() => { setCategory(blankCategory()); setNotice(''); }}>Nova categoria</button>{!categoriesOnly && <button className={button} onClick={() => { setForm(blankProduct()); setNotice(''); }}>Novo produto</button>}</div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#e6eee8] p-4">{notice}</p>}
    {loading ? <p role="status">Carregando catálogo...</p> : <>
      {category && <form onSubmit={e => save(e, true)} className="space-y-4 rounded-2xl bg-white p-6"><h3 className="text-lg font-bold">{category._id ? 'Editar categoria' : 'Nova categoria'}</h3><fieldset disabled={saving} className="space-y-4"><Field label="Nome"><input required minLength={2} maxLength={100} className={input} value={category.nome} onChange={e => setCategory({ ...category, nome: e.target.value, slug: category._id ? category.slug : slugify(e.target.value) })} /></Field><Field label="Slug"><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} value={category.slug} onChange={e => setCategory({ ...category, slug: e.target.value })} /></Field><Field label="Descrição"><textarea maxLength={500} className={input} value={category.descricao} onChange={e => setCategory({ ...category, descricao: e.target.value })} /></Field><label className="flex gap-2"><input type="checkbox" checked={category.ativo} onChange={e => setCategory({ ...category, ativo: e.target.checked })} />Categoria ativa</label><div className="flex gap-4"><button className={button}>Salvar categoria</button><button type="button" onClick={() => setCategory(null)}>Cancelar</button></div></fieldset></form>}
      {categoriesOnly && <section className="space-y-3 rounded-2xl bg-white p-6">{data.categorias.length === 0 && <p>Nenhuma categoria cadastrada.</p>}{data.categorias.map(c => <div key={c._id} className="flex items-center justify-between gap-3 border-b border-[#e5e1d5] py-3"><div><p className="font-bold">{c.nome}</p><p className="text-sm">{c.ativo ? 'Ativa' : 'Inativa'} · {data.produtos.filter(p => p.categoriaId === c._id).length} produtos</p></div><button className={button} onClick={() => setCategory({ ...c })}>Editar</button></div>)}</section>}
      {!categoriesOnly && <>
        {form && <form onSubmit={e => save(e, false)} className="rounded-2xl bg-white p-6"><h3 className="mb-5 text-lg font-bold">{form._id ? 'Editar produto' : 'Novo produto'}</h3><fieldset disabled={saving} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><Field label="Nome do produto"><input required minLength={3} maxLength={150} className={input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value, slug: form._id ? form.slug : slugify(e.target.value) })} /></Field><Field label="Slug"><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></Field></div>
          <Field label="Descrição"><textarea required maxLength={5000} rows={4} className={input} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></Field>
          <Field label="Categoria"><select required className={input} value={form.categoriaId} onChange={e => setForm({ ...form, categoriaId: e.target.value })}><option value="">Selecione uma categoria</option>{data.categorias.map(c => <option key={c._id} value={c._id}>{c.nome}{c.ativo ? '' : ' (inativa)'}</option>)}</select></Field>
          <Field label="Imagens — uma URL HTTP ou HTTPS por linha (até 12); a primeira será a capa"><textarea rows={3} className={input} value={form.imagensTexto} onChange={e => setForm({ ...form, imagensTexto: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-3">{form.imagensTexto.split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s)).slice(0, 12).map((url, i) => <img key={`${i}-${url}`} src={url} referrerPolicy="no-referrer" alt={`Prévia da imagem ${i + 1}`} className="h-24 w-24 rounded-lg border object-cover" />)}</div>
          <h4 className="font-bold">Variações e estoque</h4>
          {form.variacoes.map((v, i) => <div key={v._id || i} className="space-y-4 rounded-xl border border-[#e5e1d5] p-4"><div className="flex justify-between gap-3"><h5 className="font-semibold">Variação {i + 1}</h5><button type="button" disabled={form.variacoes.length === 1 || v.estoqueReservado > 0} onClick={() => setForm({ ...form, variacoes: form.variacoes.filter((_, index) => index !== i) })}>Remover</button></div><div className="grid gap-4 sm:grid-cols-3"><Field label="SKU único"><input required minLength={3} maxLength={80} className={input} value={v.sku} onChange={e => variant(i, 'sku', e.target.value)} /></Field><Field label="Preço (R$)"><input required inputMode="decimal" placeholder="0,00" className={input} value={v.preco} onChange={e => variant(i, 'preco', e.target.value)} /></Field><Field label="Preço anterior (R$), opcional"><input inputMode="decimal" placeholder="Sem desconto" className={input} value={v.precoOriginal} onChange={e => variant(i, 'precoOriginal', e.target.value)} /></Field><Field label="Estoque disponível"><input required type="number" min="0" step="1" className={input} value={v.estoqueDisponivel} onChange={e => variant(i, 'estoqueDisponivel', e.target.value)} /></Field></div><Field label="Atributos — um por linha, como Cor: Rosa ou Tamanho: A5"><textarea className={input} value={v.atributosTexto} onChange={e => variant(i, 'atributosTexto', e.target.value)} /></Field><div className="flex flex-wrap gap-5"><label className="flex gap-2"><input type="checkbox" checked={v.ativo} onChange={e => variant(i, 'ativo', e.target.checked)} />Variação ativa</label><span className="text-sm">Reservado: {v.estoqueReservado || 0}</span></div></div>)}
          <button type="button" className={button} disabled={form.variacoes.length >= 100} onClick={() => setForm({ ...form, variacoes: [...form.variacoes, blankVariant()] })}>Adicionar variação</button>
          <Field label="Cupom de frete"><select className={input} value={form.shippingCouponLevel || ''} onChange={e => setForm({ ...form, shippingCouponLevel: e.target.value ? Number(e.target.value) : null })}><option value="">Sem cupom de frete</option>{[1, 2, 3].map(n => <option key={n} value={n}>FRETE{n} — nível {n}</option>)}</select></Field>
          <label className="flex gap-2"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />Produto ativo</label><div className="flex gap-4"><button className={button}>{saving ? 'Salvando...' : 'Salvar produto'}</button><button type="button" onClick={() => setForm(null)}>Cancelar</button></div>
        </fieldset></form>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Buscar por nome ou SKU"><input className={input} value={search} onChange={e => setSearch(e.target.value)} /></Field><Field label="Filtrar categoria"><select className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="">Todas as categorias</option>{data.categorias.map(c => <option key={c._id} value={c._id}>{c.nome}</option>)}</select></Field></div>
        <section className="overflow-x-auto rounded-2xl bg-white p-5"><table className="w-full text-left text-sm"><caption className="pb-4 text-left font-semibold">{products.length} produto(s)</caption><thead><tr>{['Produto', 'Categoria', 'Preço', 'Disponível', 'Reservado', 'Status', 'Ações'].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{products.map(p => <tr key={p._id} className="border-t border-[#e5e1d5]"><td className="p-3"><div className="flex items-center gap-3">{p.imagens[0] && <img src={p.imagens[0]} referrerPolicy="no-referrer" alt="" className="h-12 w-12 rounded object-cover" />}<div className="font-semibold">{p.nome}<p className="text-xs font-normal">{p.variacoes.length} variação(ões)</p></div></div></td><td className="p-3">{data.categorias.find(c => c._id === p.categoriaId)?.nome || '—'}</td><td className="whitespace-nowrap p-3">A partir de {money(Math.min(...p.variacoes.map(v => v.precoCentavos)))}</td><td className="p-3">{p.variacoes.reduce((sum, v) => sum + v.estoqueDisponivel, 0)}</td><td className="p-3">{p.variacoes.reduce((sum, v) => sum + v.estoqueReservado, 0)}</td><td className="p-3">{p.ativo ? 'Ativo' : 'Inativo'}</td><td className="p-3"><button className={button} onClick={() => edit(p)}>Editar</button></td></tr>)}</tbody></table>{products.length === 0 && <p className="p-4">Nenhum produto encontrado.</p>}</section>
      </>}
    </>}
  </div>;
}
