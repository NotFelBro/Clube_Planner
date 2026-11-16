import { afterEach, expect, it, vi } from 'vitest';
import { adminApi } from '../frontend/src/services/adminApi.js';
afterEach(() => vi.unstubAllGlobals());
it('não repete uma gravação cuja resposta se perdeu', async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('segredo de rede')); vi.stubGlobal('fetch', fetch);
  await expect(adminApi('/products', 'teste', { method: 'POST', body: {} })).rejects.toMatchObject({ resultadoIncerto: true, status: 0, message: expect.stringContaining('confira') });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('preserva o código e o identificador de uma falha do servidor', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, message: 'Serviço indisponível.', requestId: 'teste-123' }, { status: 503 })));
  await expect(adminApi('/settings', 'teste', { method: 'PUT', body: {} })).rejects.toMatchObject({ status: 503, requestId: 'teste-123', resultadoIncerto: true });
});
it('trata uma consulta indisponível sem repetir a requisição', async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('falha de rede')); vi.stubGlobal('fetch', fetch);
  await expect(adminApi('/overview', 'teste')).rejects.toMatchObject({ resultadoIncerto: false });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('recusa sucesso incompleto e preserva cancelamento por saída da página', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true })));
  await expect(adminApi('/catalog', 'teste')).rejects.toThrow('incompleta');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')));
  await expect(adminApi('/catalog', 'teste')).rejects.toMatchObject({ name: 'AbortError' });
});
