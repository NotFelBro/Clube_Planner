function validarConfiguracaoSegura(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  let origem;
  try { origem = new URL(env.FRONTEND_URL); } catch { throw new Error('FRONTEND_URL HTTPS é obrigatória em produção.'); }
  if (origem.protocol !== 'https:' || origem.username || origem.password || origem.origin !== env.FRONTEND_URL) throw new Error('FRONTEND_URL deve ser uma origem HTTPS sem caminho ou credenciais.');
  if (typeof env.JWT_ACCESS_SECRET !== 'string' || env.JWT_ACCESS_SECRET.length < 64) throw new Error('JWT_ACCESS_SECRET deve ter ao menos 64 caracteres.');
  if (typeof env.EMAIL_CODE_SECRET !== 'string' || Buffer.byteLength(env.EMAIL_CODE_SECRET) < 32) throw new Error('EMAIL_CODE_SECRET deve ter ao menos 32 bytes.');
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI é obrigatória.');
}
module.exports = { validarConfiguracaoSegura };
