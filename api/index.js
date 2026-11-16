// Entrada Vercel: sem listen(), timers persistentes ou desconexão após cada requisição.
module.exports = require('../src/serverless').criarHandler();
