require('dotenv').config({ quiet: true });
async function main() {
  let ready = true;
  function check(label, ok) { console.log(`${ok ? 'OK' : 'PENDENTE'}: ${label}`); if (!ok) ready = false; }
  check('Modo Mercado Pago de teste', process.env.CHECKOUT_TEST_MODE === 'mercado_pago' && process.env.NODE_ENV !== 'production');
  check('Access Token configurado no backend', Boolean(process.env.MP_ACCESS_TOKEN));
  check('Assinatura secreta do webhook configurada', Boolean(process.env.MP_WEBHOOK_SECRET));
  for (const key of ['FRONTEND_URL', 'MP_WEBHOOK_URL']) {
    let valid = false;
    try { const url = new URL(process.env[key]); valid = url.protocol === 'https:' && !url.username && !url.password && !['localhost', '127.0.0.1'].includes(url.hostname) && (key !== 'MP_WEBHOOK_URL' || url.pathname === '/api/v1/shop/mercado-pago/webhook'); } catch { /* Configuração pendente. */ }
    check(`${key} pública HTTPS`, valid);
  }
  if (process.env.MP_ACCESS_TOKEN) {
    try {
      const res = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15000) });
      const account = await res.json();
      check('Credencial válida de vendedor de teste brasileiro', res.ok && account.tags?.includes('test_user') && account.site_id === 'MLB');
    } catch { check('Conexão com Mercado Pago', false); }
  }
  console.log(ready ? 'Configuração pronta para iniciar uma compra de teste.' : 'Preencha os itens pendentes antes de abrir o checkout.');
  process.exitCode = ready ? 0 : 1;
}
main().catch(() => { console.error('Não foi possível verificar a configuração.'); process.exitCode = 1; });
