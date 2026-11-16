import { expect, it } from 'vitest';
import protection from '../src/middlewares/adminProtection.js';
it('recusa excesso de operações e libera a capacidade após sucesso ou falha', async () => {
  const executar = protection.criarExecutorAdmin(2);
  let liberar1, liberar2;
  const primeira = executar(() => new Promise(resolve => { liberar1 = resolve; }));
  const segunda = executar(() => new Promise(resolve => { liberar2 = resolve; }));
  await expect(executar(async () => 'terceira')).rejects.toMatchObject({ statusCode: 429 });
  liberar1('ok'); liberar2('ok'); await Promise.all([primeira, segunda]);
  await expect(executar(async () => { throw new Error('falha'); })).rejects.toThrow('falha');
  await expect(executar(async () => 'recuperado')).resolves.toBe('recuperado');
});
