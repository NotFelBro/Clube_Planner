import useEmailRequest from "../../components/auth/useEmailRequest.js";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import BrandLogo from "../../components/brand/BrandLogo.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import PrivacyConsent from "../../components/auth/PrivacyConsent.jsx";
import { solicitarSenha, salvarSenha } from "../../services/cadastroApi.js";

export default function RecuperarSenha({ redefinir = false }) {
  const location = useLocation();
  const envioEmail = useEmailRequest();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [email, setEmail] = useState(location.state?.email || "");
  const [senha, setSenha] = useState("");
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  useEffect(() => {
    if (redefinir && window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [redefinir]);
  async function enviar(event) {
    event.preventDefault();
    if (ocupado || redefinir && concluido) return;
    if (!redefinir && !envioEmail.iniciar()) return;
    let enviado = false;
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const resultado = redefinir ? await salvarSenha({ token, senha, aceitouPrivacidade }) : await solicitarSenha(email);
      enviado = true;
      setMensagem(resultado.mensagem); setConcluido(true); setSenha("");
    } catch (error) { setErro(error.message); }
    finally { if (!redefinir) envioEmail.concluir(enviado); setOcupado(false); }
  }
  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[minmax(0,38.8889fr)_minmax(0,61.1111fr)]">
      <aside className="wallpaper-blue flex min-w-0 flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-[58px]">
        <Link to="/" aria-label="Clube Planner — voltar ao login" className="inline-block w-fit max-w-full">
          <BrandLogo inverse className="w-64 sm:w-72" />
        </Link>
        <div className="flex flex-1 flex-col justify-center py-12 lg:py-0">
          <span className="w-fit rounded-full bg-sage px-4 py-2 text-[11px] font-semibold text-slatebrand">SEGURANÇA DA SUA CONTA</span>
          <h1 className="mt-9 max-w-[430px] font-display text-[32px] font-semibold leading-[1.4] sm:text-[38px]">
            Uma nova senha.
            <span className="block">O mesmo carinho.</span>
          </h1>
          <p className="mt-6 max-w-[430px] text-[15px] leading-[1.65]">
            Redefina sua senha para voltar a acessar sua conta e acompanhar seus pedidos no Clube Planner.
          </p>
          <div className="mt-12 hidden max-w-[340px] rounded-[22px] bg-[#e8f1e8] p-8 text-center text-slatebrand sm:block">
            <div aria-hidden="true" className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white">
              {redefinir ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg> : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 5 10 8L22 5" /></svg>}
            </div>
            <p className="mt-5 font-display text-lg font-semibold">{redefinir ? "Proteja seu próximo capítulo" : "Verifique sua caixa de entrada"}</p>
            <p className="mt-2 text-sm">{redefinir ? "Sua nova senha fica salva na sua conta." : "O link de redefinição é válido por 10 minutos."}</p>
          </div>
        </div>
        <p className="pb-3 text-[13px] font-medium">Clube Planner • Papelaria com afeto</p>
      </aside>

      <section className="flex min-w-0 items-center justify-center px-5 py-12 sm:px-10 lg:px-[60px]">
        <div className="w-full max-w-[560px]">
          <header>
            <h2 className="font-display text-[30px] font-semibold leading-tight">{redefinir && concluido ? "Senha redefinida!" : "Redefina sua senha"}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{redefinir ? concluido ? "Agora você pode entrar na sua conta com a nova senha." : "Escolha uma nova senha para continuar acessando sua conta." : "Informe seu e-mail cadastrado. Enviaremos um link para você redefinir sua senha com segurança."}</p>
          </header>
          <div className="mt-10">
            <p className="text-[13px] font-semibold text-terracotta">{redefinir ? "02  Nova senha" : "01  Redefinição por e-mail"}</p>
            <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-[#e6e2d4]">
              <div className={`h-full rounded-full bg-terracotta ${redefinir ? "w-full" : "w-1/2"}`} />
            </div>
          </div>

          {!redefinir && <div className="mt-8 rounded-[16px] border border-line bg-white p-6">
            <p className="text-sm font-semibold">{concluido ? "Acesse sua caixa de entrada" : "Receba seu link de redefinição"}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{concluido ? "Se houver uma conta verificada com esse e-mail, você receberá uma mensagem do Clube Planner para redefinir a senha. Verifique também a pasta de spam." : "Acesse o link recebido no seu e-mail para escolher uma nova senha. Ele pode ser usado uma única vez."}</p>
            {concluido && <>
              <p className="mt-4 break-all rounded-lg bg-softsage p-3 text-center text-sm font-semibold">{email.trim()}</p>
              <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer" className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95">Abrir Gmail ↗</a>
              <p className="mt-4 text-center text-xs leading-5 text-muted">Se utiliza outro provedor de e-mail, abra sua caixa de entrada normalmente.</p>
            </>}
          </div>}

          {(!redefinir || !concluido) && <form onSubmit={enviar} className="mt-8">
            {redefinir ? <>
              <PasswordField id="nova-senha" label="Nova senha" value={senha} onChange={e => setSenha(e.target.value)} disabled={ocupado} autoComplete="new-password" />
              <PrivacyConsent checked={aceitouPrivacidade} onChange={e => setAceitouPrivacidade(e.target.checked)} disabled={ocupado} />
            </> : <>
              <label htmlFor="redefinicao-email" className="mb-2 block text-xs font-medium text-muted">E-mail cadastrado</label>
              <input id="redefinicao-email" type="email" name="email" required maxLength={254} autoComplete="email" placeholder="voce@email.com" value={email} onChange={e => { setEmail(e.target.value); setConcluido(false); setMensagem(""); setErro(""); }} disabled={ocupado} className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand outline-offset-2 focus:border-sage disabled:opacity-60" />
            </>}
            <button disabled={ocupado || (!redefinir && envioEmail.segundos > 0) || redefinir && !token} className="mt-4 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60">{ocupado ? "Aguarde..." : redefinir ? "Redefinir senha" : envioEmail.segundos > 0 ? `Reenviar em ${envioEmail.segundos}s` : concluido ? "Reenviar link de redefinição" : "Enviar link de redefinição"}</button>
            {!redefinir && <p className="mt-3 text-center text-xs text-muted">Aguarde pelo menos 60 segundos entre solicitações.</p>}
          </form>}
          {mensagem && <p role="status" className="mt-6 rounded-lg border border-sage bg-[#e8f1e8] p-4 text-sm">{redefinir ? "Sua senha foi redefinida com sucesso. Entre na sua conta para continuar." : "Se houver uma conta verificada com esse e-mail, enviaremos um link de redefinição de senha."}</p>}
          {erro && <p role="alert" className="mt-6 rounded-lg border border-terracotta bg-[#fae7de] p-4 text-sm">{erro}</p>}
          {redefinir && !token && <p role="alert" className="mt-6 text-sm">Link incompleto. <Link to="/recuperar-senha" className="font-semibold text-terracotta underline">Solicitar outro link de redefinição</Link></p>}
          <div className="mt-10 text-center"><Link to="/" className="text-sm font-semibold text-terracotta hover:underline">Voltar para o login</Link></div>
          <p className="mt-16 text-[11px] leading-5 text-muted">Seus dados são protegidos e utilizados conforme nossa política de privacidade.</p>
        </div>
      </section>
    </main>
  );
}
