import { fetchJson } from "./fetchJson.js";

export class CadastroApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "CadastroApiError";
    this.status = status;
  }
}

const BASE_URL = "/api/v1/auth";

async function requisitar(caminho, dados) {
  let response;
  let payload;

  try {
    ({ response, payload } = await fetchJson(`${BASE_URL}${caminho}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(dados),
    }));
  } catch (error) {
    throw new CadastroApiError(
      error?.message && (error.name === "TimeoutError" || error.status) ? error.message : "Não foi possível conectar ao servidor. Verifique sua conexão.",
      error?.status || 0
    );
  }

  if (!response.ok || payload?.success !== true) {
    const fallback =
      response.status === 409
        ? "Não foi possível concluir a solicitação."
        : response.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos."
          : response.status === 503
            ? "Serviço temporariamente indisponível."
            : "Não foi possível concluir a operação.";

    throw new CadastroApiError(
      typeof payload?.message === "string"
        ? payload.message
        : fallback,
      response.status
    );
  }

  return payload;
}

export async function cadastrarCliente(dados) {
  const payload = await requisitar(
    "/register",
    dados
  );

  if (!payload.data?.usuario) {
    throw new CadastroApiError(
      "O servidor não confirmou os dados do cadastro."
    );
  }

  return {
    usuario: payload.data.usuario,
    linkEnviado: payload.data.linkEnviado === true,
    mensagem: payload.message,
  };
}

export async function solicitarLinkEmail(email) {
  const payload = await requisitar(
    "/send-verification",
    { email }
  );

  return {
    mensagem:
      payload.message ||
      "Se a conta estiver elegível, enviaremos um link.",
  };
}

export async function confirmarLinkEmail(token) {
  const payload = await requisitar(
    "/verify-email",
    { token }
  );

  return {
    mensagem:
      payload.message ||
      "E-mail confirmado com sucesso.",
    sessaoCriada:
      Boolean(payload.data?.accessToken),
  };
}

export async function solicitarSenha(email) {
  return (await requisitar("/forgot-password", { email })).data;
}
export async function salvarSenha(dados) {
  return (await requisitar("/reset-password", dados)).data;
}
