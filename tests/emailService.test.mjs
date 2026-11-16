import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');
const service = require('../src/services/emailService');
const token = 'a'.repeat(64);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('e-mails transacionais', () => {
  it('bloqueia SMTP real durante qualquer teste automatizado', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const transporte = vi.spyOn(nodemailer, 'createTransport');
    await expect(service.enviarLinkSenha('teste@example.com', `http://localhost:5173/redefinir-senha#token=${token}`)).rejects.toThrow('bloqueado');
    await expect(service.enviarLinkVerificacao('teste@example.com', `http://localhost:5173/confirmar-email#token=${token}`)).rejects.toThrow('bloqueado');
    expect(transporte).not.toHaveBeenCalled();
  });
  it.each(['senha', 'verificacao', 'alteracao'])('envia uma única mensagem com HTML e alternativa em texto: %s', async tipo => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com'); vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_USER', 'loja@example.com'); vi.stubEnv('SMTP_PASS', 'teste');
    const sendMail = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
    const senha = tipo === 'senha';
    const url = `http://localhost:5173/${senha ? 'redefinir-senha' : tipo === 'alteracao' ? 'confirmar-alteracao-email' : 'confirmar-email'}#token=${token}`;
    await (senha ? service.enviarLinkSenha : tipo === 'alteracao' ? service.enviarLinkAlteracaoEmail : service.enviarLinkVerificacao)('teste@example.com', url);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mensagem = sendMail.mock.calls[0][0];
    expect(mensagem.to).toBe('teste@example.com');
    expect(mensagem.html).toContain(`href="${url}"`);
    expect(mensagem.html).toContain(senha ? 'Redefinir minha senha' : tipo === 'alteracao' ? 'Confirmar novo e-mail' : 'Verificar minha conta');
    expect(mensagem.html).toContain('10 minutos');
    expect(mensagem.text).toContain(url);
  });
});
