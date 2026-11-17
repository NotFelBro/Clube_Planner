import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validarUri, testarUri } = require('../scripts/check-atlas.cjs');
const uri = 'mongodb+srv://clube_planner_app:senhaFicticia123@mongo10.mv3l968.mongodb.net/clube_planner?authSource=admin';

describe('verificação privada da conexão Atlas', () => {
  it('aceita URI completa com senha codificada', () => {
    expect(validarUri(uri)).toBe(uri);
    const codificada = uri.replace('senhaFicticia123', 'senha%40%23%25');
    expect(validarUri(codificada)).toBe(codificada);
  });
  it.each([
    uri.replace('clube_planner_app:', '<clube_planner_app>:'),
    uri.replace('senhaFicticia123', '<senhaFicticia123>'),
    uri.replace('clube_planner_app:', 'LimaDB:'),
    uri.replace('/clube_planner?', '/?'),
    uri.replace('authSource=admin', 'authSource=clube_planner'),
    uri.replace('senhaFicticia123', 'senha%invalida'),
    '"' + uri + '"',
  ])('recusa problemas de montagem sem revelar a entrada', valor => {
    expect(() => validarUri(valor)).toThrow();
    try { validarUri(valor); } catch (error) { expect(error.message).not.toMatch(/senhaFicticia123|mongodb\+srv:\/\//); }
  });
  it('usa somente ping e fecha a conexão', async () => {
    const conexao = { asPromise: vi.fn().mockResolvedValue(undefined), db: { command: vi.fn().mockResolvedValue({ ok: 1 }) }, close: vi.fn().mockResolvedValue(undefined) };
    const criar = vi.fn(() => conexao);
    await testarUri(uri, criar);
    expect(criar).toHaveBeenCalledWith(uri, expect.objectContaining({ autoIndex: false, autoCreate: false }));
    expect(conexao.db.command).toHaveBeenCalledWith({ ping: 1 });
    expect(conexao.close).toHaveBeenCalledTimes(1);
  });
  it('fecha o recurso mesmo se a autenticação falhar', async () => {
    const erro = Object.assign(new Error('Não registrar esta mensagem'), { code: 8000 });
    const conexao = { asPromise: vi.fn().mockRejectedValue(erro), close: vi.fn().mockResolvedValue(undefined) };
    await expect(testarUri(uri, () => conexao)).rejects.toBe(erro);
    expect(conexao.close).toHaveBeenCalledTimes(1);
  });
});
