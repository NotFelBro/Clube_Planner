const readline = require('node:readline');
const { Writable } = require('node:stream');
const mongoose = require('mongoose');

function validarUri(valor) {
  if (typeof valor !== 'string' || !valor.trim()) throw new Error('Cole a conexão completa, começando por mongodb+srv://.');
  const uri = valor.trim();
  if (/[<>]/.test(uri) || /%3[ce]/i.test(uri)) throw new Error('Remova os marcadores < e > do usuário e da senha.');
  let url;
  try { url = new URL(uri); } catch { throw new Error('Formato de conexão inválido. Confira separadores e codificação da senha.'); }
  if (url.protocol !== 'mongodb+srv:' || url.hostname !== 'mongo10.mv3l968.mongodb.net') throw new Error('Use a conexão SRV do cluster Mongo10 copiada do Atlas.');
  let usuario;
  try { usuario = decodeURIComponent(url.username); } catch { throw new Error('Codificação do usuário inválida.'); }
  if (usuario !== 'clube_planner_app') throw new Error('O usuário na conexão precisa ser clube_planner_app.');
  if (!url.password) throw new Error('A senha está vazia na conexão.');
  try { decodeURIComponent(url.password); } catch { throw new Error('Codificação da senha inválida. Codifique somente a senha.'); }
  if (url.pathname !== '/clube_planner') throw new Error('O banco após mongodb.net/ precisa ser clube_planner.');
  if (url.searchParams.get('authSource') !== 'admin') throw new Error('Acrescente authSource=admin às opções da conexão.');
  if (url.hash) throw new Error('Há um # não codificado. Codifique somente a senha antes de montar a conexão.');
  return uri;
}

async function testarUri(uri, criarConexao = (...args) => mongoose.createConnection(...args)) {
  let conexao;
  try {
    conexao = criarConexao(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 1, autoIndex: false, autoCreate: false });
    await conexao.asPromise();
    await conexao.db.command({ ping: 1 });
  } finally {
    if (conexao) await conexao.close().catch(() => {});
  }
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error('Execute este comando diretamente no terminal, sem colar a conexão no comando.');
    process.exitCode = 1;
    return;
  }
  const saidaOculta = new Writable({ write(chunk, encoding, callback) { callback(); } });
  const leitor = readline.createInterface({ input: process.stdin, output: saidaOculta, terminal: true, historySize: 0 });
  leitor.on('SIGINT', () => { leitor.close(); process.exitCode = 1; });
  process.stdout.write('Cole a conexão completa do Atlas (texto oculto) e pressione Enter: ');
  let uri;
  try {
    const valor = await new Promise(resolve => leitor.question('', resolve));
    leitor.close();
    process.stdout.write('\n');
    uri = validarUri(valor);
  } catch (error) {
    leitor.close();
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  try {
    await testarUri(uri);
    console.log('OK: formato correto e autenticação aceita pelo Atlas. Nenhum dado foi alterado.');
    console.log('Use exatamente esta conexão no Value de MONGODB_URI da Vercel e faça um novo Redeploy.');
  } catch (error) {
    // Não imprimir mensagens do driver, URI, usuário/senha ou endereços internos.
    if (error.code === 18 || error.code === 8000) console.error('FALHA: Atlas recusou o usuário/senha. Confira a senha salva no usuário clube_planner_app.');
    else if (error.name === 'MongooseServerSelectionError') console.error('FALHA: não foi possível alcançar o Atlas. Confira o cluster e a lista de acesso de rede.');
    else console.error('FALHA: não foi possível concluir o teste de conexão.');
    if (Number.isSafeInteger(error.code)) console.error('Código:', error.code);
    process.exitCode = 1;
  }
}

if (require.main === module) main().catch(() => { console.error('Teste interrompido.'); process.exitCode = 1; });
module.exports = { validarUri, testarUri };
