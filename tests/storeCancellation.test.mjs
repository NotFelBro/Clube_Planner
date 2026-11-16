import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Order = require('../src/models/order');
const mp = require('../src/services/mercadoPagoService');
const service = require('../src/services/storeOrderService');
const id = '000000000000000000000001';
const userId = '000000000000000000000002';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function preparar(overrides = {}) {
  vi.stubEnv('CHECKOUT_TEST_MODE', 'mercado_pago');
  const pedido = { _id: id, status: 'aguardando_pagamento', ambienteTeste: true, pagamentoTipo: 'mercado_pago', totalCentavos: 400, ...overrides };
  vi.spyOn(Order, 'findOne').mockResolvedValue(pedido);
  vi.spyOn(Order, 'findOneAndUpdate').mockResolvedValue({ ...pedido, cancelamentoSolicitadoEm: new Date() });
  vi.spyOn(Order, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  vi.spyOn(mp, 'encerrarPreferencia').mockResolvedValue({});
  vi.spyOn(mp, 'buscarPagamentos').mockResolvedValue([]);
  return pedido;
}
describe('cancelamento de pedidos', () => {
  it('cancela antes de iniciar pagamento sem exigir acesso ao provedor', async () => {
    preparar();
    await service.cancelarPedido(userId, id);
    expect(mp.buscarPagamentos).not.toHaveBeenCalled();
    expect(Order.updateOne).toHaveBeenCalledWith(expect.objectContaining({ userId }), expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelado', 'reserva.status': 'liberado', checkoutUrl: null }) }));
  });
  it('bloqueia pedidos entregues', async () => {
    preparar({ status: 'entregue' });
    await expect(service.cancelarPedido(userId, id)).rejects.toThrow('entregue');
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('não altera pedidos de outra conta', async () => {
    preparar(); Order.findOne.mockResolvedValue(null);
    await expect(service.cancelarPedido(userId, id)).rejects.toThrow('não encontrado');
    expect(Order.findOne).toHaveBeenCalledWith({ _id: id, userId });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('preserva a intenção para repetir quando o provedor falha', async () => {
    preparar({ preferenceId: 'pref' }); mp.encerrarPreferencia.mockRejectedValue(new Error('indisponível'));
    await expect(service.cancelarPedido(userId, id)).rejects.toThrow('indisponível');
    expect(Order.findOneAndUpdate).toHaveBeenCalled();
    expect(Order.updateOne).not.toHaveBeenCalled();
  });
  it('não marca como cancelado um pedido pago sem localizar o pagamento', async () => {
    preparar({ status: 'pago', pagoEm: new Date(), preferenceId: 'pref' });
    await expect(service.cancelarPedido(userId, id)).rejects.toThrow('confirmar o pagamento');
    expect(Order.updateOne).not.toHaveBeenCalled();
  });
  it('impede abrir pagamento após solicitar cancelamento', async () => {
    preparar({ cancelamentoSolicitadoEm: new Date() });
    await expect(service.iniciarPagamento(userId, id)).rejects.toThrow('cancelamento');
  });
});
