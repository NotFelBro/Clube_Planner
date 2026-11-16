const mongoose = require('mongoose');
const { connectDB } = require('./database');
const { validarConfiguracaoSegura } = require('./security');

let inicializacao;
let pronta = false;

// Uma inicialização compartilhada por instância, inclusive com chamadas concorrentes.
async function inicializarAplicacao() {
  if (pronta && mongoose.connection.readyState !== 1) {
    inicializacao = undefined;
    pronta = false;
  }
  if (!inicializacao) {
    inicializacao = (async () => {
      validarConfiguracaoSegura();
      const User = require('../models/User');
      User.schema.set('autoIndex', false);
      await connectDB();
      await User.init();
      await require('./userIndexes').garantirIndicesUsuario(User.collection);
      // Carregar também os modelos usados fora das rotas de autenticação.
      for (const arquivo of ['product', 'Category', 'catalogCounter', 'adminEvent', 'storeSettings', 'order']) {
        require(`../models/${arquivo}`);
      }
      await Promise.all(Object.values(mongoose.models).map(model => model.init()));
      if (process.env.VERCEL !== '1') {
        await require('../services/catalogService').inicializarCatalogo({ estoqueInicial: 100 });
      }
      pronta = true;
    })().catch(error => {
      inicializacao = undefined;
      pronta = false;
      throw error;
    });
  }
  return inicializacao;
}

module.exports = { inicializarAplicacao };
