import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mp = require("../src/services/mercadoPagoService");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function configurar() {
  vi.stubEnv("CHECKOUT_TEST_MODE", "mercado_pago"); vi.stubEnv("MP_ACCESS_TOKEN", "test-secret");
  vi.stubEnv("FRONTEND_URL", "https://loja.example"); vi.stubEnv("MP_WEBHOOK_URL", "https://api.example/api/v1/shop/mercado-pago/webhook"); vi.stubEnv("MP_WEBHOOK_SECRET", "secret");
}
const pedido = { _id: "000000000000000000000001", itens: [{ lineId: "sample-1", nomeProduto: "Planner", quantidade: 2, precoUnitarioCentavos: 100 }], reserva: { expiresAt: new Date(Date.now() + 600000) } };
describe("Adaptador Mercado Pago", () => {
  it("identifica credencial rejeitada sem registrar o token", async () => {
    configurar();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(mp.criarPreferencia(pedido)).rejects.toThrow("rejeitou a credencial");
      expect(JSON.parse(log.mock.calls[0][0])).toEqual({
        evento: "falha_mercado_pago", operacao: "validar_vendedor", statusProvedor: 401,
      });
    } finally {
      log.mockRestore();
    }
  });
  it("bloqueia vendedor real antes de criar preferência", async () => {
    configurar(); const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, tags: [] }) }); vi.stubGlobal("fetch", fetch);
    await expect(mp.criarPreferencia(pedido)).rejects.toThrow("vendedor de teste"); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("envia preços e referência do servidor e usa checkout de sandbox", async () => {
    configurar(); const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, tags: ["test_user"] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "pref", sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref" }) }); vi.stubGlobal("fetch", fetch);
    const resultado = await mp.criarPreferencia(pedido);
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.external_reference).toBe(pedido._id); expect(body.items[0]).toMatchObject({ unit_price: 1, quantity: 2, currency_id: "BRL" });
    expect(resultado.checkoutUrl).toContain("sandbox"); expect(body.back_urls.success).toContain(pedido._id);
  });
  it.each([false, true])("inclui o frete no total, inclusive quando os produtos são gratuitos: %s", async (gratuito) => {
    configurar();
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, tags: ["test_user"] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "pref", sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref" }) });
    vi.stubGlobal("fetch", fetch);
    await mp.criarPreferencia({ ...pedido, freteCentavos: 600, itens: pedido.itens.map((item) => ({ ...item, precoUnitarioCentavos: gratuito ? 0 : 100 })) });
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.items.every((item) => item.unit_price > 0)).toBe(true);
    const total = body.items.reduce((s, item) => s + item.quantity * item.unit_price, 0) + (body.shipments?.cost || 0);
    expect(total).toBe(gratuito ? 6 : 8);
    if (!gratuito) expect(body.shipments).toEqual({ mode: "not_specified", cost: 6 });
  });

  it("recusa pagamento de outro vendedor ou com live_mode", async () => {
    configurar();
    for (const pagamento of [{ collector_id: 2, live_mode: false }, { collector_id: 1, live_mode: true }]) {
      const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, tags: ["test_user"] }) }).mockResolvedValueOnce({ ok: true, json: async () => pagamento }); vi.stubGlobal("fetch", fetch);
      await expect(mp.consultarPagamento("123")).rejects.toThrow("ambiente de teste");
    }
  });
});

it('permite teste localhost sem webhook e sem URLs de retorno públicas', async () => {
  configurar();
  vi.stubEnv('FRONTEND_URL', 'http://localhost:5173');
  vi.stubEnv('MP_WEBHOOK_URL', ''); vi.stubEnv('MP_WEBHOOK_SECRET', '');
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, tags: ['test_user'] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pref', sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref' }) });
  vi.stubGlobal('fetch', fetch);
  await mp.criarPreferencia(pedido);
  const body = JSON.parse(fetch.mock.calls[1][1].body);
  expect(body).not.toHaveProperty('notification_url');
  expect(body).not.toHaveProperty('back_urls');
  expect(body).not.toHaveProperty('auto_return');
  expect(body.external_reference).toBe(pedido._id);
});

describe('cancelamento e reembolso no provedor', () => {
  const pagamento = { id: 123, collector_id: 1, live_mode: false, external_reference: pedido._id, status: 'approved' };
  function simular(status, resultado) {
    const resposta = dado => ({ ok: true, json: async () => dado });
    const fetch = vi.fn()
      .mockResolvedValueOnce(resposta({ id: 1, tags: ['test_user'] }))
      .mockResolvedValueOnce(resposta({ ...pagamento, status }))
      .mockResolvedValueOnce(resposta({ id: 456 }))
      .mockResolvedValueOnce(resposta({ id: 1, tags: ['test_user'] }))
      .mockResolvedValueOnce(resposta({ ...pagamento, status: resultado }));
    vi.stubGlobal('fetch', fetch); return fetch;
  }
  it('reembolsa integralmente com chave estável e confere o resultado', async () => {
    configurar(); const fetch = simular('approved', 'refunded');
    expect((await mp.cancelarOuReembolsar(pagamento, pedido._id)).status).toBe('refunded');
    expect(fetch.mock.calls[2][0]).toContain('/v1/payments/123/refunds');
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({});
    expect(fetch.mock.calls[2][1].headers['X-Idempotency-Key']).toHaveLength(64);
  });
  it('cancela pagamento pendente', async () => {
    configurar(); const fetch = simular('pending', 'cancelled');
    await mp.cancelarOuReembolsar(pagamento, pedido._id);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ status: 'cancelled' });
  });
  it('não declara reembolso concluído enquanto pagamento continua aprovado', async () => {
    configurar(); simular('approved', 'approved');
    await expect(mp.cancelarOuReembolsar(pagamento, pedido._id)).rejects.toThrow('pendente');
  });
  it('recusa pagamento de outro pedido antes de reembolsar', async () => {
    configurar(); const fetch = simular('approved', 'refunded');
    await expect(mp.cancelarOuReembolsar(pagamento, 'outro')).rejects.toThrow('não pertence');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

it('recusa webhook antigo mesmo que a assinatura seja válida', async () => {
  configurar();
  const { createHmac } = await import('node:crypto');
  const id = '123', requestId = 'teste', ts = String(Date.now() - 6 * 60000);
  const assinatura = createHmac('sha256', 'secret').update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  const headers = { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${assinatura}` };
  expect(() => mp.validarAssinatura({ query: { 'data.id': id }, get: nome => headers[nome] })).toThrow('expirada');
});

it('aceita a resposta live_mode=true somente após conferir vendedor test_user e metadados de teste', async () => {
  configurar();
  const payment = { id: 123, collector_id: 1, live_mode: true, external_reference: pedido._id, metadata: { ambiente: 'teste', order_id: pedido._id }, transaction_amount: 0.9, shipping_amount: 3 };
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async()=>({id:1,tags:['test_user']}) }).mockResolvedValueOnce({ ok: true, json: async()=>payment });
  vi.stubGlobal('fetch',fetch);
  expect(mp.pagamentoTesteValidado(payment)).toBe(false);
  const validado = await mp.consultarPagamento('123');
  expect(mp.pagamentoTesteValidado(validado)).toBe(true);
  expect(mp.pagamentoTesteValidado({...validado})).toBe(false);
  expect(mp.valorPagamentoCentavos(validado)).toBe(390);
});
it('busca mantém pagamentos do vendedor de teste mesmo com live_mode=true',async()=>{
 configurar();
 const payment={id:123,collector_id:1,live_mode:true,external_reference:pedido._id,metadata:{ambiente:'teste',order_id:pedido._id}};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({id:1,tags:['test_user']})}).mockResolvedValueOnce({ok:true,json:async()=>({results:[payment],paging:{total:1}})}));
 const result=await mp.buscarPagamentos(pedido._id);
 expect(result).toHaveLength(1);expect(mp.pagamentoTesteValidado(result[0])).toBe(true);
});
it.each([{transaction_amount:1,shipping_amount:-1},{transaction_amount:'erro'}, {transaction_amount:Infinity}, {transaction_amount:1,shipping_amount:'erro'}])('rejeita valores inválidos sem aprovar o pedido',p=>{
 expect(()=>mp.valorPagamentoCentavos(p)).toThrow('Valor do pagamento inválido');
});
