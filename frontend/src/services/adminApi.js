import { fetchJson } from './fetchJson.js';

export class AdminApiError extends Error {
  constructor(message, { status = 0, requestId, resultadoIncerto = false, cause } = {}) {
    super(message, { cause });
    this.name = 'AdminApiError'; this.status = status; this.requestId = requestId; this.resultadoIncerto = resultadoIncerto;
  }
}
export async function adminApi(path, accessToken, { method = 'GET', body, signal } = {}) {
  const escrita = !['GET', 'HEAD'].includes(method.toUpperCase());
  let response, payload;
  try {
    ({ response, payload } = await fetchJson(`/api/v1/admin${path}`, { method, signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }));
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new AdminApiError(escrita ? 'Não foi possível confirmar o resultado. Atualize a lista e confira se a alteração foi salva antes de enviar novamente.' : error.status ? 'O servidor retornou uma resposta inesperada. Atualize os dados para tentar novamente.' : 'Não foi possível conectar ao servidor. Tente novamente em instantes.', { status: error.status || 0, resultadoIncerto: escrita, cause: error });
  }
  const requestId = payload?.requestId || response.headers?.get?.('x-request-id');
  if (!response.ok || payload?.success !== true) throw new AdminApiError((payload?.message || 'Não foi possível concluir a operação administrativa.') + (escrita && response.status >= 500 ? ' Atualize os dados e confira o resultado antes de enviar novamente.' : ''), { status: response.status, requestId, resultadoIncerto: escrita && response.status >= 500 });
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new AdminApiError('A resposta do servidor está incompleta. Atualize os dados antes de continuar.', { status: response.status, requestId, resultadoIncerto: escrita });
  return payload.data;
}
export function notificarCatalogo() {
  window.dispatchEvent(new Event('clube-catalogo-atualizado'));
  try { localStorage.setItem('clube-catalogo-revisao', String(Date.now())); } catch { /* Atualização por foco continua disponível. */ }
}
