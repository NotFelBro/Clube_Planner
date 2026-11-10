
import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../../contexts/AuthContext.jsx";

export default function LogoutButton() {
  const navigate = useNavigate();
  const { sair } = useAuth();

  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState("");

  async function handleLogout() {
    if (saindo) {
      return;
    }

    setSaindo(true);
    setErro("");

    try {
      // Encerra a sessão no backend e limpa
      // os dados de autenticação do frontend.
      await sair();

      // Retorna à tela de login sem preservar
      // o endereço da página privada.
      navigate("/", {
        replace: true,
        state: null,
      });
    } catch {
      // O AuthContext já limpa a sessão local,
      // mesmo quando o backend retorna erro.
      setErro(
        "Sua sessão local foi encerrada, mas não foi possível confirmar o logout no servidor."
      );

      navigate("/", {
        replace: true,
        state: null,
      });
    } finally {
      setSaindo(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={handleLogout}
        disabled={saindo}
        className="inline-flex min-h-11 w-full items-center gap-4 rounded-lg px-4 py-3 text-left text-sm font-semibold text-terracotta transition hover:bg-[#fae7de] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="w-5 text-center text-lg"
        >
          ↪
        </span>

        <span>
          {saindo
            ? "Saindo da conta..."
            : "Sair da conta"}
        </span>
      </button>

      {erro && (
        <p
          role="alert"
          className="mt-2 px-4 text-xs text-terracotta"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
