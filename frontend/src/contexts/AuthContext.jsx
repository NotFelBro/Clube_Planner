
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  autenticarCliente,
  renovarAutenticacao,
  encerrarAutenticacao,
  obterMeuPerfil,
  atualizarMeuPerfil,
} from "../services/authApi.js";

const AuthContext = createContext(null);

// Compartilha a renovação entre chamadas simultâneas,
// inclusive durante a verificação inicial do StrictMode.
let renovacaoPendente = null;

function renovarUmaVez(opcoes) {
  if (!renovacaoPendente) {
    const requisicao = Promise.resolve().then(() =>
      renovarAutenticacao(opcoes)
    );

    renovacaoPendente = requisicao;

    void requisicao.then(
      () => {
        if (renovacaoPendente === requisicao) {
          renovacaoPendente = null;
        }
      },
      () => {
        if (renovacaoPendente === requisicao) {
          renovacaoPendente = null;
        }
      }
    );
  }

  return renovacaoPendente;
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const tokenRef = useRef(null);
  const geracaoRef = useRef(0);
  const montadoRef = useRef(false);
  const logoutPendenteRef = useRef(null);

  // Impede que um carregamento anterior sobrescreva
  // uma atualização de perfil mais recente.
  const revisaoPerfilRef = useRef(0);

  const atualizarSessao = useCallback((dados) => {
    if (
      !dados ||
      typeof dados.accessToken !== "string" ||
      !dados.accessToken ||
      !dados.usuario
    ) {
      throw new Error(
        "O servidor retornou dados de autenticação inválidos."
      );
    }

    revisaoPerfilRef.current += 1;
    tokenRef.current = dados.accessToken;
    setAccessToken(dados.accessToken);
    setUsuario(dados.usuario);
  }, []);

  const limparSessao = useCallback(() => {
    geracaoRef.current += 1;
    revisaoPerfilRef.current += 1;
    tokenRef.current = null;
    setAccessToken(null);
    setUsuario(null);
  }, []);

  const entrar = useCallback(async (email, senha) => {
    if (logoutPendenteRef.current) await logoutPendenteRef.current;
    const geracao = ++geracaoRef.current;
    const dados = await autenticarCliente(email, senha);
    if (geracao !== geracaoRef.current || !montadoRef.current) return null;
    atualizarSessao(dados);
    setCarregando(false);
    return dados.usuario;
  }, [atualizarSessao]);

  const renovar = useCallback(async () => {
    if (logoutPendenteRef.current) {
      await logoutPendenteRef.current;
      return null;
    }

    const geracao = geracaoRef.current;

    try {
      const dados = await renovarUmaVez();

      if (
        geracao !== geracaoRef.current ||
        !montadoRef.current
      ) {
        return null;
      }

      if (dados.usuario === null) {
        limparSessao();
        return null;
      }

      atualizarSessao(dados);
      return dados.accessToken;
    } catch (erro) {
      if (
        geracao === geracaoRef.current &&
        montadoRef.current
      ) {
        limparSessao();
      }

      throw erro;
    }
  }, [atualizarSessao, limparSessao]);

  const sair = useCallback(async () => {
    if (logoutPendenteRef.current) {
      return logoutPendenteRef.current;
    }

    limparSessao();
    setCarregando(false);

    const requisicao = (async () => {
      try {
        if (renovacaoPendente) {
          try {
            await renovacaoPendente;
          } catch {
            // O logout ainda deve ser tentado.
          }
        }

        await encerrarAutenticacao();
      } finally {
        logoutPendenteRef.current = null;
      }
    })();

    logoutPendenteRef.current = requisicao;

    return requisicao;
  }, [limparSessao]);

  const carregarPerfil = useCallback(async () => {
    const token = tokenRef.current;

    if (!token) {
      return null;
    }

    const geracao = geracaoRef.current;
    const revisao = revisaoPerfilRef.current;
    const dados = await obterMeuPerfil(token);

    if (
      geracao !== geracaoRef.current ||
      revisao !== revisaoPerfilRef.current ||
      token !== tokenRef.current ||
      !montadoRef.current
    ) {
      return null;
    }

    if (!dados?.usuario) {
      throw new Error(
        "O servidor retornou um perfil inválido."
      );
    }

    setUsuario(dados.usuario);
    return dados.usuario;
  }, []);

  const atualizarPerfil = useCallback(async ({
    nome, cpf,
  }) => {
    const token = tokenRef.current;

    if (!token) {
      throw new Error(
        "Você precisa estar autenticado para atualizar seu perfil."
      );
    }

    const geracao = geracaoRef.current;
    const revisao = ++revisaoPerfilRef.current;

    const dados = await atualizarMeuPerfil(token, { nome, ...(cpf !== undefined ? { cpf } : {}) });

    if (
      geracao !== geracaoRef.current ||
      revisao !== revisaoPerfilRef.current ||
      token !== tokenRef.current ||
      !montadoRef.current
    ) {
      throw new Error(
        "A sessão foi alterada durante a atualização. Consulte seus dados novamente."
      );
    }

    if (!dados?.usuario) {
      throw new Error(
        "O servidor retornou um perfil inválido."
      );
    }

    setUsuario(dados.usuario);

    return dados.usuario;
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    let ativo = true;

    async function restaurarSessao() {
      const geracao = geracaoRef.current;

      try {
        const dados = await renovarUmaVez({ restaurar: true });

        if (
          ativo &&
          montadoRef.current &&
          geracao === geracaoRef.current
        ) {
          if (dados.usuario === null) {
            limparSessao();
          } else {
            atualizarSessao(dados);
          }
        }
      } catch {
        if (
          ativo &&
          montadoRef.current &&
          geracao === geracaoRef.current
        ) {
          limparSessao();
        }
      } finally {
        if (ativo && montadoRef.current) {
          setCarregando(false);
        }
      }
    }

    void restaurarSessao();

    return () => {
      ativo = false;
      montadoRef.current = false;
    };
  }, [atualizarSessao, limparSessao]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        accessToken,
        autenticado: Boolean(usuario && accessToken),
        carregando,
        entrar,
        sair,
        renovar,
        carregarPerfil,
        atualizarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error(
      "useAuth deve ser utilizado dentro de AuthProvider."
    );
  }

  return contexto;
}
