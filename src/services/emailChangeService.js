const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/session');
const Event = require('../models/adminEvent');
const emailService = require('./emailService');
const { AuthError, normalizarEmail } = require('./authService');
const { verificarSenha, validarSenha } = require('./passwordService');
const campos = '+alteracaoEmail.novoEmail +alteracaoEmail.emailAnterior +alteracaoEmail.tokenHash +alteracaoEmail.expiraEm +alteracaoEmail.ultimoEnvioEm +alteracaoEmail.credencialVersao';
function hashToken(token) {
  const segredo = process.env.EMAIL_CODE_SECRET;
  if (typeof segredo !== 'string' || Buffer.byteLength(segredo) < 32) throw new Error('Segredo de verificação inválido.');
  return crypto.createHmac('sha256', segredo).update('alteracao-email:' + token).digest('hex');
}
async function solicitar(userId, dados = {}) {
  const email = normalizarEmail(dados.email);
  validarSenha(dados.senhaAtual);
  const usuario = await User.findOne({ _id: userId, ativo: true, emailVerificado: true }).select('+senhaHash');
  if (!usuario || !await verificarSenha(dados.senhaAtual, usuario.senhaHash)) throw new AuthError('Senha atual incorreta.', 401);
  if (email === usuario.email) throw new AuthError('Informe um e-mail diferente do atual.');
  if (await User.exists({ email, ativo: true, _id: { $ne: usuario._id } })) throw new AuthError('Este e-mail já está em uso por outra conta ativa.', 409);
  const token = crypto.randomBytes(32).toString('hex'), tokenHash = hashToken(token), agora = new Date();
  const anterior = await User.findOneAndUpdate({ _id: usuario._id, ativo: true, email: usuario.email, senhaHash: usuario.senhaHash,
    $or: [{ 'alteracaoEmail.ultimoEnvioEm': null }, { 'alteracaoEmail.ultimoEnvioEm': { $lte: new Date(Date.now() - 60000) } }],
  }, { $set: { 'alteracaoEmail.novoEmail': email, 'alteracaoEmail.emailAnterior': usuario.email, 'alteracaoEmail.tokenHash': tokenHash,
    'alteracaoEmail.expiraEm': new Date(Date.now() + 600000), 'alteracaoEmail.ultimoEnvioEm': agora, 'alteracaoEmail.credencialVersao': usuario.credencialVersao ?? 0,
  } }, { returnDocument: 'before' }).select(campos);
  if (!anterior) throw new AuthError('Aguarde 60 segundos antes de solicitar outro link ou atualize sua sessão.', 429);
  const url = new URL('/confirmar-alteracao-email', process.env.FRONTEND_URL || 'http://localhost:5173'); url.hash = `token=${token}`;
  try { await emailService.enviarLinkAlteracaoEmail(email, url.toString()); }
  catch {
    const previa = anterior.alteracaoEmail;
    await User.updateOne({ _id: usuario._id, 'alteracaoEmail.tokenHash': tokenHash }, { $set: {
      'alteracaoEmail.novoEmail': previa?.novoEmail ?? null, 'alteracaoEmail.emailAnterior': previa?.emailAnterior ?? null,
      'alteracaoEmail.tokenHash': previa?.tokenHash ?? null, 'alteracaoEmail.expiraEm': previa?.expiraEm ?? null,
      'alteracaoEmail.ultimoEnvioEm': previa?.ultimoEnvioEm ?? null, 'alteracaoEmail.credencialVersao': previa?.credencialVersao ?? null,
    } });
    throw new AuthError('Não foi possível enviar a confirmação. Seu e-mail atual permanece o mesmo.', 503);
  }
  return { mensagem: 'Enviamos um link ao novo e-mail. A alteração só será salva depois da confirmação.', emailPendente: email };
}
async function confirmar(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AuthError('Link inválido ou expirado.');
  const tokenHash = hashToken(token);
  let resultado;
  try {
    await mongoose.connection.transaction(async session => {
      const usuario = await User.findOne({ ativo: true, 'alteracaoEmail.tokenHash': tokenHash, 'alteracaoEmail.expiraEm': { $gt: new Date() } }).select(campos).session(session);
      if (!usuario || usuario.email !== usuario.alteracaoEmail.emailAnterior || (usuario.credencialVersao ?? 0) !== usuario.alteracaoEmail.credencialVersao) throw new AuthError('Link inválido, expirado ou já utilizado.');
      const email = usuario.alteracaoEmail.novoEmail;
      usuario.email = email; usuario.emailVerificado = true; usuario.emailVerificadoEm = new Date(); usuario.credencialVersao = (usuario.credencialVersao ?? 0) + 1;
      usuario.alteracaoEmail = undefined; usuario.recuperacaoSenha = undefined; usuario.verificacaoEmail = undefined;
      await usuario.save({ session });
      await Session.updateMany({ userId: usuario._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: 'email_changed' } }, { session });
      await Event.create([{ actorId: usuario._id, acao: 'conta.email', entidadeId: String(usuario._id), descricao: 'E-mail atualizado após confirmação do novo endereço' }], { session });
      resultado = { usuarioId: String(usuario._id), email, mensagem: 'Novo e-mail confirmado. Entre novamente com ele e sua senha atual.' };
    });
  } catch (error) {
    if (error.code === 11000) throw new AuthError('Este e-mail passou a ser utilizado por outra conta ativa. Seu e-mail anterior foi preservado.', 409);
    throw error;
  }
  return resultado;
}
async function cancelar(userId) {
  await User.updateOne({ _id: userId, ativo: true }, { $unset: { alteracaoEmail: '' } });
  return { mensagem: 'Solicitação cancelada. Seu e-mail atual foi preservado.' };
}
module.exports = { solicitar, confirmar, cancelar };
