import { afterEach, expect, it, vi } from 'vitest';
import { fetchJson } from '../frontend/src/services/fetchJson.js';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('lê a resposta e não repete a operação', async () => {
  const fetch = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true }) }); vi.stubGlobal('fetch', fetch);
  expect((await fetchJson('/teste', { method: 'POST' })).payload.success).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('cancela após o prazo sem repetir uma operação de gravação', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)))); vi.stubGlobal('fetch', fetch);
  const resultado = fetchJson('/teste', { method: 'POST' }, 100);
  const expectativa = expect(resultado).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(100); await expectativa;
  expect(fetch).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it('trata respostas HTML inesperadas sem expor o corpo na tela', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 502, json: async () => { throw new Error('<html>segredo</html>'); } }));
  await expect(fetchJson('/teste')).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('segredo') });
});
