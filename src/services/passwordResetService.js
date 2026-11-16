const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/session');
const emailService = require('./emailService');
const { AuthError } = require('./authService');
const { gerarHashSenha } = require('./passwordService');
const mensagem = 'Se houver uma conta verificada com esse e-mail, enviaremos um link para definir sua senha.';
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

async function solicitarRecuperacao(email) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new AuthError('E-mail inválido.');
  const agora = new Date();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const usuario = await User.findOneAndUpdate({ email: email.trim().toLowerCase(), ativo: true, emailVerificado: true,
    $or: [{ 'recuperacaoSenha.ultimoEnvioEm': null }, { 'recuperacaoSenha.ultimoEnvioEm': { $lte: new Date(Date.now() - 60000) } }],
  }, { $set: { 'recuperacaoSenha.tokenHash': tokenHash, 'recuperacaoSenha.expiraEm': new Date(Date.now() + 600000), 'recuperacaoSenha.ultimoEnvioEm': agora } }, { returnDocument: 'before' })
    .select('+recuperacaoSenha.tokenHash +recuperacaoSenha.expiraEm +recuperacaoSenha.ultimoEnvioEm');
  if (!usuario) return { mensagem };
  const url = new URL('/redefinir-senha', process.env.FRONTEND_URL || 'http://localhost:5173');
  url.hash = `token=${token}`;
  try { await emailService.enviarLinkSenha(usuario.email, url.toString()); }
  catch {
    await User.updateOne({ _id: usuario._id, 'recuperacaoSenha.tokenHash': tokenHash }, { $set: {
      'recuperacaoSenha.tokenHash': usuario.recuperacaoSenha?.tokenHash ?? null,
      'recuperacaoSenha.expiraEm': usuario.recuperacaoSenha?.expiraEm ?? null,
      'recuperacaoSenha.ultimoEnvioEm': usuario.recuperacaoSenha?.ultimoEnvioEm ?? null,
    } });
    throw new AuthError('Não foi possível enviar o link. Tente novamente mais tarde.', 503);
  }
  return { mensagem };
}
async function redefinirSenha({ token, senha, aceitouPrivacidade } = {}) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AuthError('Link inválido ou expirado.');
  if (aceitouPrivacidade !== true) throw new AuthError('Aceite os termos de privacidade para continuar.');
  const senhaHash = await gerarHashSenha(senha);
  await mongoose.connection.transaction(async session => {
    const usuario = await User.findOneAndUpdate({ ativo: true, emailVerificado: true, 'recuperacaoSenha.tokenHash': hashToken(token), 'recuperacaoSenha.expiraEm': { $gt: new Date() } },
      { $inc: { credencialVersao: 1 }, $set: { senhaHash, privacidadeAceitaEm: new Date(), privacidadeVersao: '2026-11-13' }, $unset: { recuperacaoSenha: '', alteracaoEmail: '' } }, { session, returnDocument: 'after' });
    if (!usuario) throw new AuthError('Link inválido, expirado ou já utilizado.');
    await Session.updateMany({ userId: usuario._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: "password_changed" } }, { session });
  });
  return { mensagem: 'Senha salva. Entre na sua conta com seu e-mail e senha.' };
}
module.exports = { solicitarRecuperacao, redefinirSenha };
