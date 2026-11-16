import { fetchJson } from "./fetchJson.js";
export async function shopApi(path, accessToken, body) {
  let response;
  let payload;
  try {
    ({ response, payload } = await fetchJson(`/api/v1/shop${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }));
  } catch (error) { throw new Error(error?.message && (error.name === "TimeoutError" || error.status) ? error.message : "Não foi possível conectar ao servidor. Tente novamente.", { cause: error }); }
  if (!response.ok || !payload?.success) throw Object.assign(new Error(payload?.message || "Não foi possível concluir a operação."), { status: response.status, requestId: payload?.requestId });
  return payload.data || {};
}
