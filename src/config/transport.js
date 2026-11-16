// O proxy HTTPS executa no mesmo host; a API de produção escuta só em loopback.
function configurarTransporte(app, env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  app.set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    if (!req.secure) return res.status(426).json({ success: false, message: 'HTTPS é obrigatório.' });
    next();
  });
}
module.exports = { configurarTransporte };
