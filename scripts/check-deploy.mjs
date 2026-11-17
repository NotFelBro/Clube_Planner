import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';

// Não aceita certificados inválidos nem redirecionamentos silenciosos para outro host.
function obter(url) {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, { timeout: 10000 }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; if (body.length > 2e6) req.destroy(new Error('Resposta excessiva.')); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('timeout', () => req.destroy(new Error('Timeout HTTP.')));
    req.on('error', reject);
  });
}
function testarTLS(url, versao, aceitar) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: url.hostname, port: Number(url.port || 443), servername: url.hostname,
      minVersion: versao, maxVersion: versao, ciphers: 'DEFAULT:@SECLEVEL=0', rejectUnauthorized: true });
    socket.setTimeout(10000, () => socket.destroy(new Error('Timeout TLS.')));
    socket.once('secureConnect', () => {
      socket.end();
      if (!aceitar) reject(new Error(`${versao} foi aceito pelo servidor.`));
      else resolve();
    });
    socket.once('error', error => {
      // Erros locais de cifra/certificado/rede não comprovam rejeição de TLS legado.
      if (!aceitar && error.code === 'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION') resolve();
      else reject(error);
    });
  });
}
try {
  const origem = new URL(process.argv[2]);
  assert(origem.protocol === 'https:' && origem.pathname === '/' && !origem.search && !origem.hash && !origem.username && !origem.password, 'Informe somente a origem HTTPS pública.');
  for (const versao of ['TLSv1.2', 'TLSv1.3']) { await testarTLS(origem, versao, true); console.log(`OK: ${versao} e certificado válido`); }
  for (const versao of ['TLSv1', 'TLSv1.1']) { await testarTLS(origem, versao, false); console.log(`OK: ${versao} recusado pelo servidor`); }
  const httpUrl = new URL(origem); httpUrl.protocol = 'http:'; httpUrl.port = process.argv[3] || ''; // Porta HTTP opcional para homologação local.
  const redirecionamento = await obter(httpUrl);
  assert([301, 302, 307, 308].includes(redirecionamento.status), 'HTTP precisa redirecionar para HTTPS.');
  assert.equal(new URL(redirecionamento.headers.location, httpUrl).origin, origem.origin, 'Destino do redirecionamento incorreto.');
  for (const caminho of ['/', '/api/v1/health']) {
    const resposta = await obter(new URL(caminho, origem));
    assert.equal(resposta.status, 200, `${caminho}: HTTP 200 esperado.`);
    assert.match(resposta.headers['strict-transport-security'] || '', /max-age=(\d+)/);
    assert(Number(/max-age=(\d+)/.exec(resposta.headers['strict-transport-security'])[1]) >= 31536000, 'HSTS deve durar ao menos um ano.');
    assert.equal(resposta.headers['x-content-type-options'], 'nosniff');
    assert(['DENY', 'SAMEORIGIN'].includes(resposta.headers['x-frame-options']), 'Proteção contra enquadramento ausente.');
    assert(resposta.headers['content-security-policy'], 'CSP ausente.');
    assert(!resposta.headers['x-powered-by'], 'Assinatura do servidor exposta.');
    if (caminho.includes('/api/')) {
      assert.equal(resposta.headers['cache-control'], 'no-store');
      assert.equal(JSON.parse(resposta.body).success, true);
    }
    console.log(`OK: ${caminho}, cabeçalhos e resposta`);
  }
} catch (error) {
  console.error('Validação de deploy falhou:', error.message);
  console.error('Uso: npm run deploy:check -- https://SEU_DOMINIO');
  process.exitCode = 1;
}
