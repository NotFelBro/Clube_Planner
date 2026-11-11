export async function shopApi(path, accessToken, body) {
  let response;
  try {
    response = await fetch(`/api/v1/shop${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error("Não foi possível conectar ao servidor. Tente novamente."); }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.message || "Não foi possível concluir a operação.");
  return payload.data || {};
}
