
const BASE_URL = "/api/v1/auth";

export class AuthApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function requisitar(
  caminho,
  {
    method = "GET",
    body,
    accessToken,
    signal,
  } = {}
) {
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;

  try {
    response = await fetch(`${BASE_URL}${caminho}`, {
      method,
      headers,
      credentials: "include",
      signal,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new AuthApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão."
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new AuthApiError(
      "O servidor retornou uma resposta inesperada.",
      response.status
    );
  }

  if (!response.ok || payload?.success !== true) {
    const fallback =
      response.status === 401
        ? "Sessão inválida ou expirada."
        : response.status === 403
          ? "Acesso não autorizado."
          : response.status === 429
            ? "Muitas tentativas. Aguarde alguns minutos."
            : "Não foi possível concluir a operação.";

    throw new AuthApiError(
      typeof payload?.message === "string"
        ? payload.message
        : fallback,
      response.status
    );
  }

  return payload.data ?? {};
}

export function autenticarCliente(email) {
  return requisitar("/login", { method: "POST", body: { email } });
}

export async function renovarAutenticacao() {
  return requisitar("/refresh", {
    method: "POST",
  });
}

export async function obterMeuPerfil(accessToken) {
  return requisitar("/me", {
    accessToken,
  });
}

export async function atualizarMeuPerfil(
  accessToken,
  { nome }
) {
  return requisitar("/me", {
    method: "PATCH",
    accessToken,
    body: {
      nome,
    },
  });
}

export async function encerrarAutenticacao() {
  return requisitar("/logout", {
    method: "POST",
  });
}


export function obterMinhasSessoes(accessToken) {
  return requisitar("/sessions", { accessToken });
}



export function listarDadosConta(recurso, accessToken) {
  return requisitar(`/${recurso}`, { accessToken });
}
export function salvarDadosConta(recurso, accessToken, body) {
  return requisitar(`/${recurso}`, { method: "POST", accessToken, body });
}
