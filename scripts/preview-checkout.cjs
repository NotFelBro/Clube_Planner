// Preview local do build: apenas frontend compilado e API; não expõe arquivos do projeto.
require('dotenv').config({ quiet: true });
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
const backendPort = Number(process.env.PORT) || 3002;
app.use('/api', (req, res) => {
  const proxy = http.request({ hostname: '127.0.0.1', port: backendPort, path: req.originalUrl, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${backendPort}` } }, upstream => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', () => { if (!res.headersSent) res.status(502).json({ success: false, message: 'API de teste indisponível.' }); else res.end(); });
  req.pipe(proxy);
});
const dist = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(dist));
app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(3003, '127.0.0.1', () => console.log('Preview do checkout: http://127.0.0.1:3003'));
