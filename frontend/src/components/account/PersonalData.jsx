import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import PasswordField from '../auth/PasswordField.jsx';
import useEmailRequest from '../auth/useEmailRequest.js';
import { solicitarAlteracaoEmail, cancelarAlteracaoEmail } from '../../services/authApi.js';

const field = 'mt-2 h-11 w-full rounded-lg border border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand disabled:bg-sand disabled:opacity-70';
const button = 'min-h-11 rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-white disabled:opacity-50';
const digits = value => String(value || '').replace(/\D/g, '');
function cpfFormatado(value) {
  return digits(value).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
}
export default function PersonalData() {
  const { usuario, carregarPerfil } = useAuth();
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    carregarPerfil().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [carregarPerfil]);
  return <PersonalDataForm key={usuario?.id} usuario={usuario} loading={loading} loadError={error} />;
}
function PersonalDataForm({ usuario, loading, loadError }) {
  const { atualizarPerfil, accessToken, carregarPerfil } = useAuth();
  const [draft, setDraft] = useState({}), [novoEmail, setNovoEmail] = useState(''), [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const pending = useRef(false), envio = useEmailRequest();
  const nome = draft.nome ?? usuario?.nome ?? '', cpf = draft.cpf ?? cpfFormatado(usuario?.cpf);
  const mudou = nome.trim() !== (usuario?.nome || '').trim() || digits(cpf) !== digits(usuario?.cpf);
  const disabled = loading || Boolean(busy);
  function alterar(campo, valor) { setDraft(atual => ({ ...atual, [campo]: valor })); setError(''); setNotice(''); }
  async function salvar(event) {
    event.preventDefault(); if (pending.current || !mudou) return;
    pending.current = true; setBusy('perfil'); setError(''); setNotice('');
    try { await atualizarPerfil({ nome: nome.trim(), cpf: digits(cpf) }); setDraft({}); setNotice('Nome e CPF atualizados com sucesso.'); }
    catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(''); }
  }
  async function solicitar(event) {
    event.preventDefault(); if (pending.current || !envio.iniciar()) return;
    pending.current = true; setBusy('email'); setError(''); setNotice(''); let enviado = false;
    try {
      const resultado = await solicitarAlteracaoEmail(accessToken, novoEmail.trim().toLowerCase(), senha);
      enviado = true; setNotice(resultado.mensagem); setNovoEmail('');
      try { await carregarPerfil(); } catch { setError('O link foi enviado, mas não foi possível atualizar a tela. Recarregue seu perfil antes de solicitar outro.'); }
    } catch (e) { setError(e.message); }
    finally { envio.concluir(enviado); setSenha(''); pending.current = false; setBusy(''); }
  }
  async function cancelar() {
    if (pending.current) return; pending.current = true; setBusy('cancelar'); setError(''); setNotice('');
    try {
      const resultado = await cancelarAlteracaoEmail(accessToken); setNotice(resultado.mensagem);
      try { await carregarPerfil(); } catch { setError('A solicitação foi cancelada. Recarregue a página para atualizar seus dados.'); }
    } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(''); }
  }
  return <div className="space-y-6">
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <h2 className="font-display text-xl font-semibold">Dados pessoais</h2><p className="mt-2 text-sm text-muted">Consulte e atualize as informações vinculadas à sua conta.</p>
      {loading && <p role="status" className="mt-4 text-sm">Carregando dados da conta...</p>}
      {(error || loadError) && <p role="alert" className="mt-4 rounded-lg bg-[#fae7de] p-3 text-sm text-red-800">{error || loadError}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-softsage p-3 text-sm">{notice}</p>}
      <form onSubmit={salvar} className="mt-5 space-y-4"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-muted">Nome completo<input className={field} required minLength={3} maxLength={120} autoComplete="name" value={nome} onChange={e => alterar('nome', e.target.value)} /></label>
        <label className="text-xs text-muted">E-mail verificado<input className={field} type="email" value={usuario?.email || ''} readOnly aria-readonly="true" /></label>
        <label className="text-xs text-muted">CPF<input className={field} inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" value={cpf} onChange={e => alterar('cpf', cpfFormatado(e.target.value))} /></label>
      </fieldset><button className={button} disabled={disabled || !mudou}>{busy === 'perfil' ? 'Salvando...' : 'Salvar alterações'}</button><p className="text-xs leading-6 text-muted">Nome e CPF podem ser atualizados. A troca de e-mail precisa ser confirmada no novo endereço.</p></form>
    </section>
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <h2 className="font-display text-xl font-semibold">Alterar e-mail</h2><p className="mt-2 text-sm leading-6 text-muted">Seu e-mail atual continua válido para entrar na loja e aparece no painel administrativo até você confirmar o novo endereço.</p>
      {usuario?.emailPendente && <div role="status" className="mt-4 rounded-xl bg-softsage p-4 text-sm"><p>Confirmação pendente para <strong className="break-all">{usuario.emailPendente}</strong>.</p><p className="mt-2 text-xs">Abra o link enviado para esse endereço. Ele expira em 10 minutos.</p><button type="button" className="mt-3 font-semibold text-terracotta underline disabled:opacity-50" disabled={disabled} onClick={cancelar}>Cancelar solicitação</button></div>}
      <form onSubmit={solicitar} className="mt-5 space-y-4"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-muted">Novo e-mail<input required type="email" maxLength={254} autoComplete="email" className={field} value={novoEmail} onChange={e => { setNovoEmail(e.target.value); setError(''); setNotice(''); }} placeholder="Seu novo endereço de e-mail" /></label>
        <PasswordField id="senha-alteracao-email" label="Confirme sua senha atual" value={senha} onChange={e => setSenha(e.target.value)} disabled={disabled} />
      </fieldset><button className={button} disabled={disabled || envio.segundos > 0}>{busy === 'email' ? 'Enviando confirmação...' : envio.segundos > 0 ? `Solicitar novamente em ${envio.segundos}s` : 'Enviar confirmação ao novo e-mail'}</button></form>
    </section>
  </div>;
}
