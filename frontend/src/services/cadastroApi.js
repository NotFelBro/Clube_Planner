
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

  try {
    response = await fetch(`${BASE_URL}${caminho}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(dados),
    });
  } catch {
    throw new CadastroApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão."
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new CadastroApiError(
      "Resposta inesperada do servidor.",
      response.status
    );
  }

  if (!response.ok || payload?.success !== true) {
    const fallback =
      response.status === 409
        ? "E-mail já cadastrado."
        : response.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : response.status === 503
            ? "Serviço temporariamente indisponível. Tente novamente."
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
  const payload = await requisitar("/register", dados);

  if (!payload.data?.usuario) {
    throw new CadastroApiError(
      "O servidor não confirmou os dados do cadastro."
    );
  }

  return {
    usuario: payload.data.usuario,
    codigoEnviado: payload.data.codigoEnviado === true,
    mensagem: payload.message,
  };
}

export async function solicitarCodigoEmail(email) {
  const payload = await requisitar(
    "/send-verification",
    { email }
  );

  return {
    mensagem:
      payload.message ||
      "Se o e-mail estiver elegível, um código será enviado.",
  };
}

export async function confirmarCodigoEmail(email, codigo) {
  const payload = await requisitar(
    "/verify-email",
    {
      email,
      codigo,
    }
  );

  return {
    mensagem:
      payload.message ||
      "E-mail confirmado com sucesso.",
  };
}
