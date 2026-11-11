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
