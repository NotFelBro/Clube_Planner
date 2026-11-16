const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
let ativos = 0;
async function derivar(senha, salt) {
  if (ativos >= 4) throw Object.assign(new Error('Muitas solicitações de senha. Aguarde um instante e tente novamente.'), { statusCode: 429 });
  ativos++;
  try { return await scrypt(senha, salt, 64); }
  finally { ativos--; }
}

function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length === 0) {
    const erro = new Error('Informe sua senha.'); erro.statusCode = 400; throw erro;
  }
  return senha;
}
async function gerarHashSenha(senha) {
  validarSenha(senha);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await derivar(senha, salt);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
async function verificarSenha(senha, armazenado) {
  validarSenha(senha);
  const valido = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(armazenado || '');
  const [, salt, hash] = valido ? armazenado.split('$') : ['scrypt', '0'.repeat(32), '0'.repeat(128)];
  const calculado = await derivar(senha, salt);
  return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex')) && valido;
}
module.exports = { validarSenha, gerarHashSenha, verificarSenha };
