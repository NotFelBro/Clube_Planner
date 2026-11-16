import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useStore } from "../../components/layout/StoreContext.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { shopApi } from "../../services/shopApi.js";

export default function ProductFeedbacks() {
  const { id } = useParams();
  return <FeedbackContent key={id} id={id} />;
}
function FeedbackContent({ id }) {
  const { products } = useStore();
  const product = products.find(p => p.id === Number(id));
  const { accessToken, autenticado } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    shopApi(`/products/${id}/reviews`).then((dados) => { if (ativo) setAvaliacoes(dados.avaliacoes); })
      .catch((error) => { if (ativo) setErro(error.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [id]);
  async function enviar(event) {
    event.preventDefault();
    if (salvando) return;
    setErro(""); setMessage("");
    if (!rating || !comment.trim()) { setErro("Selecione uma nota e escreva seu comentário."); return; }
    setSalvando(true);
    try {
      await shopApi(`/products/${id}/reviews`, accessToken, { nota: rating, comentario: comment });
      setMessage("Avaliação salva! Você pode atualizar sua avaliação enviando novamente.");
      const dados = await shopApi(`/products/${id}/reviews`);
      setAvaliacoes(dados.avaliacoes); setComment(""); setRating(0);
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  }
  if (!product) return <p className="p-10">Produto não encontrado.</p>;
  const media = avaliacoes.length ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1) : "—";
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-10">
    <Link to={`/produto/${id}`} className="return-action">← Voltar ao produto</Link>
    <h1 className="mt-5 font-display text-3xl font-semibold">Avaliações de {product.name}</h1>
    <p className="mt-4 text-xl">{media} / 5 · {avaliacoes.length} avaliações</p>
    {erro && <p role="alert" className="mt-4 text-sm text-red-800">{erro}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-line bg-white p-6"><h2 className="text-xl font-semibold">Opiniões dos compradores</h2>
        {carregando && <p role="status">Carregando avaliações...</p>}
        {!carregando && !avaliacoes.length && <p className="text-sm text-muted">Ainda não há avaliações.</p>}
        {avaliacoes.map((a) => <article key={a._id} className="rounded-xl bg-sand p-4"><p className="font-semibold">{a.nome} · {a.nota}/5</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{a.comentario}</p><p className="mt-2 text-xs text-muted">{a.ambienteTeste ? "Compra de teste confirmada" : "Compra confirmada"} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}</p></article>)}
      </section>
      <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-6"><h2 className="text-xl font-semibold">Deixe seu feedback</h2><p className="mt-2 text-sm text-muted">Disponível após concluir a compra deste produto. Uma avaliação por conta.</p>
        {!autenticado ? <Link to="/" state={{ from: { pathname: `/produto/${id}/feedbacks` } }} className="mt-4 inline-block text-terracotta underline">Entrar para avaliar</Link> : <form onSubmit={enviar} className="mt-5 space-y-4"><fieldset disabled={salvando}><legend className="text-sm">Sua nota</legend><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} estrelas`} aria-pressed={rating === n} className="text-3xl text-terracotta">{n <= rating ? "★" : "☆"}</button>)}</div><label className="mt-4 block text-sm">Comentário<textarea required maxLength={1000} rows={5} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-2 w-full rounded-xl border border-line p-3" /></label></fieldset><button disabled={salvando} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{salvando ? "Salvando..." : "Enviar avaliação"}</button>{message && <p role="status" className="text-sm text-green-900">{message}</p>}</form>}
      </section>
    </div>
  </main>;
}
