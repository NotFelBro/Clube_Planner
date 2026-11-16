import { describe, it, expect } from 'vitest';
import service from '../src/services/passwordService.js';
describe('senhas sem restrições de composição', () => {
  it.each(['a', ' ', 'palavra simples', 'á🔒漢字'.repeat(1000)])('preserva todos os caracteres e valida a senha %s', async senha => {
    const hash = await service.gerarHashSenha(senha);
    expect(hash).not.toContain(senha.length > 1 ? senha : 'texto-original');
    expect(await service.verificarSenha(senha, hash)).toBe(true);
    expect(await service.verificarSenha(senha + 'x', hash)).toBe(false);
  });
  it('não trunca senhas longas e gera salts diferentes', async () => {
    const senha = 'x'.repeat(1000);
    const hash = await service.gerarHashSenha(senha);
    expect(await service.verificarSenha('x'.repeat(999) + 'y', hash)).toBe(false);
    expect(await service.gerarHashSenha(senha)).not.toBe(hash);
  });
  it('exige senha preenchida e não autentica contas sem hash', async () => {
    expect(() => service.validarSenha('')).toThrow('Informe');
    expect(() => service.validarSenha({})).toThrow('Informe');
    expect(await service.verificarSenha('senha', null)).toBe(false);
  });
});

it('limita derivações simultâneas para evitar esgotamento de memória', async () => {
  const resultados = await Promise.allSettled(Array.from({ length: 5 }, () => service.gerarHashSenha('teste')));
  expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(4);
  expect(resultados.find(r => r.status === 'rejected').reason.statusCode).toBe(429);
});
