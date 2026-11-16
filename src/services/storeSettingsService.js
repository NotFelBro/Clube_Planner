const Settings = require('../models/storeSettings');
const {
  AuthError
} = require('./authService');
const defaults = {
  versao: 0,
  nome: 'Clube Planner',
  emailAtendimento: '',
  mensagemTopo: 'Frete a partir de R$ 3,00 • Calculado pelo CEP de entrega',
  estoqueCritico: 5
};
async function configuracao() {
  return {
    ...defaults,
    ...(await Settings.findById('loja').lean())
  };
}
async function configuracaoPublica() {
  const {
    nome,
    emailAtendimento,
    mensagemTopo
  } = await configuracao();
  return {
    nome,
    emailAtendimento,
    mensagemTopo
  };
}
async function salvar(dados, session) {
  if (typeof dados?.nome !== 'string' || !dados.nome.trim() || dados.nome.length > 100 || typeof dados.emailAtendimento !== 'string' || dados.emailAtendimento.length > 254 || dados.emailAtendimento && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.emailAtendimento) || typeof dados.mensagemTopo !== 'string' || dados.mensagemTopo.length > 200 || !Number.isSafeInteger(dados.estoqueCritico) || dados.estoqueCritico < 0 || dados.estoqueCritico > 10000) throw new AuthError('Revise os dados da loja e o limite de estoque.');
  const versao = dados.versao ?? 0;
  if (!Number.isSafeInteger(versao) || versao < 0) throw new AuthError('Versão de configuração inválida.');
  const filtro = { _id: 'loja', ...(versao === 0 ? { $or: [{ versao: 0 }, { versao: { $exists: false } }] } : { versao }) };
  try {
    const atualizado = await Settings.findOneAndUpdate(filtro, { $inc: { versao: 1 }, $set: {
      nome: dados.nome.trim(), emailAtendimento: dados.emailAtendimento.trim(), mensagemTopo: dados.mensagemTopo.trim(), estoqueCritico: dados.estoqueCritico,
    } }, { session, upsert: versao === 0, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: false });
    if (!atualizado) throw new AuthError('As configurações foram alteradas. Recarregue os dados antes de salvar novamente.', 409);
    return atualizado;
  } catch (error) {
    if (error.code === 11000) throw new AuthError('As configurações foram alteradas. Recarregue os dados antes de salvar novamente.', 409);
    throw error;
  }
}
module.exports = { configuracao, configuracaoPublica, salvar };
