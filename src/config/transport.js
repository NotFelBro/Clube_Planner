// No servidor próprio o proxy é local. Na Vercel a entrada é gerida pela plataforma.
function configurarTransporte(app, env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  app.set('trust proxy', env.VERCEL === '1' ? 1 : 'loopback');
  app.use((req, res, next) => {
    if (!req.secure) return res.status(426).json({ success: false, message: 'HTTPS é obrigatório.' });
    next();
  });
}
module.exports = { configurarTransporte };
