import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import BrandLogo from '../../components/brand/BrandLogo.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { confirmarAlteracaoEmail } from '../../services/authApi.js';
export default function ConfirmarAlteracaoEmail() {
  const { usuario, sair } = useAuth();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [busy, setBusy] = useState(false), [resultado, setResultado] = useState(null), [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); }, []);
  async function confirmar() {
    if (pending.current || resultado) return; pending.current = true; setBusy(true); setError('');
    try {
      const dados = await confirmarAlteracaoEmail(token); setResultado(dados);
      if (usuario?.id === dados.usuarioId) { try { await sair(); } catch { /* A troca e a revogação das sessões já foram confirmadas pelo servidor. */ } }
    } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-sand px-5 py-12 text-slatebrand"><section className="w-full max-w-lg rounded-3xl border border-line bg-white p-8 text-center sm:p-10">
    <div className="mx-auto w-fit rounded-xl bg-slatebrand p-4"><BrandLogo inverse className="w-56" /></div>
    <div aria-hidden="true" className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-softsage text-4xl">{resultado ? '✓' : '✉'}</div>
    <h1 className="mt-6 font-display text-3xl font-semibold">{resultado ? 'Novo e-mail confirmado!' : 'Confirme seu novo e-mail'}</h1>
    <p className="mt-4 text-sm leading-7 text-muted">{resultado ? 'O novo endereço foi salvo na sua conta e atualizado na loja. Entre novamente usando seu novo e-mail e a senha atual.' : 'Clique abaixo para concluir a troca. Seu e-mail atual será substituído somente após esta confirmação.'}</p>
    {(!token || error) && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error || 'Este link está incompleto. Abra o link recebido no novo e-mail ou solicite outra confirmação na sua conta.'}</p>}
    {!resultado && <button className="mt-6 min-h-12 w-full rounded-xl bg-terracotta px-4 font-semibold text-white disabled:opacity-50" disabled={busy || !/^[a-f0-9]{64}$/.test(token)} onClick={confirmar}>{busy ? 'Confirmando...' : 'Confirmar alteração de e-mail'}</button>}
    {resultado && <Link to="/" state={{ email: resultado.email }} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-terracotta px-4 font-semibold text-white">Entrar com o novo e-mail</Link>}
    <Link to="/perfil" className="mt-5 block text-sm font-semibold text-terracotta underline">Voltar para minha conta</Link>
  </section></main>;
}
