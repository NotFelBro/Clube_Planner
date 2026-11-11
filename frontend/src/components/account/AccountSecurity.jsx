import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { obterMinhasSessoes } from "../../services/authApi.js";

function DeviceIcon({ tipo }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-8 w-8 shrink-0 text-terracotta">
      {tipo === "unknown" ? <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v1" /></> : tipo === "desktop" ? <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></> : <><rect x={tipo === "tablet" ? 4 : 6} y="2" width={tipo === "tablet" ? 16 : 12} height="20" rx="2" /><path d="M10 18h4" /></>}
    </svg>
  );
}

export default function AccountSecurity() {
  const { usuario, accessToken, carregarPerfil } = useAuth();
  const [sessoes, setSessoes] = useState([]);
  const [erroSessoes, setErroSessoes] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState("");

  useEffect(() => {
    let ativo = true;
    obterMinhasSessoes(accessToken).then((dados) => {
      if (ativo) setSessoes(dados.sessoes);
    }).catch((error) => {
      if (ativo) setErroSessoes(error.message);
    }).finally(() => { if (ativo) setCarregando(false); });
    carregarPerfil().catch((error) => { if (ativo) setErroPerfil(error.message); });
    return () => { ativo = false; };
  }, [accessToken, carregarPerfil]);

  const verificado = usuario?.emailVerificado === true;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <h2 className="font-display text-xl font-semibold">Segurança da conta</h2>
      <p className="mt-2 text-sm text-muted">Gerencie a proteção dos seus dados e acessos.</p>
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-line p-5">
          <h3 className="font-semibold">Sessões e dispositivos</h3>
          <p className="mt-2 text-sm text-muted">Dispositivos com sessões ativas na sua conta.</p>
          {carregando && <p role="status" className="mt-4 text-sm">Carregando sessões...</p>}
          {erroSessoes && <p role="alert" className="mt-4 text-sm text-red-800">{erroSessoes}</p>}
          {!carregando && !erroSessoes && sessoes.length === 0 && <p className="mt-4 text-sm">Nenhuma sessão ativa encontrada.</p>}
          <ul className="mt-4 space-y-3">
            {sessoes.map((sessao) => (
              <li key={sessao.id} className="flex items-center gap-3 rounded-lg bg-sand p-3">
                <DeviceIcon tipo={sessao.dispositivo.tipo} />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{sessao.dispositivo.nome}</p>
                  {sessao.atual && <p className="text-green-800">Esta sessão</p>}
                  <p className="mt-1 text-xs text-muted">Último acesso ou renovação: {new Date(sessao.ultimaAtividade).toLocaleString("pt-BR")}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">A identificação depende do navegador. A marca e o modelo podem não estar disponíveis.</p>
        </div>
        <div className={`rounded-xl border p-5 ${verificado ? "border-green-300 bg-green-50 text-green-900" : "border-line"}`}>
          <h3 className="font-semibold">Verificação da conta</h3>
          <p className="mt-3 text-sm">{verificado ? "✓ Conta verificada — e-mail confirmado por código." : usuario?.emailVerificado === false ? "E-mail ainda não verificado." : "Consultando a verificação do e-mail..."}</p>
          <p className="mt-2 break-words text-sm">{usuario?.email}</p>
          {erroPerfil && <p role="alert" className="mt-2 text-sm">Não foi possível atualizar o status: {erroPerfil}</p>}
        </div>
      </div>
    </section>
  );
}
