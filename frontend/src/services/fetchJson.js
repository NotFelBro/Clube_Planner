// Uma requisição por ação: não repete automaticamente operações que podem já ter sido gravadas.
export async function fetchJson(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const originalSignal = options.signal;
  const cancelar = () => controller.abort(originalSignal.reason);
  if (originalSignal?.aborted) cancelar();
  else originalSignal?.addEventListener('abort', cancelar, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('O servidor demorou para responder. Confira o resultado antes de tentar novamente.', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let payload;
    try { payload = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw Object.assign(new Error('O servidor retornou uma resposta inesperada. Tente novamente mais tarde.'), { status: response.status, cause: error });
    }
    return { response, payload };
  } finally {
    clearTimeout(timer);
    originalSignal?.removeEventListener('abort', cancelar);
  }
}
