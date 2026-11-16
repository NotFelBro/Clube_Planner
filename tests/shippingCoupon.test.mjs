import { describe, it, expect } from 'vitest';
import service from '../src/services/shippingCouponService.js';
import products from '../shared/sampleProducts.json';
const { aplicarCupomFrete } = service;
describe('cupons de frete por produto e distância', () => {
  for (const nivel of [1, 2, 3]) {
    it(`isenta somente o nível ${nivel} com produto participante`, () => {
      const produto = products.find(p => p.shippingCouponLevel === nivel);
      const itens = [{ id: produto.id, quantidade: 1 }];
      const frete = { nivel, valorCentavos: nivel * 300 };
      expect(aplicarCupomFrete(frete, itens, `FRETE${nivel}`)).toMatchObject({ valorCentavos: 0, descontoCentavos: nivel * 300, cupom: `FRETE${nivel}` });
      expect(() => aplicarCupomFrete({ ...frete, nivel: nivel === 3 ? 1 : 3 }, itens, `FRETE${nivel}`)).toThrow(/nível/);
      expect(() => aplicarCupomFrete(frete, [{ id: 2, quantidade: 1 }], `FRETE${nivel}`)).toThrow(/participante/);
    });
  }
  it('preserva a cotação sem cupom e rejeita códigos inventados', () => {
    const frete = { nivel: 1, valorCentavos: 300 };
    expect(aplicarCupomFrete(frete, [], '')).toBe(frete);
    expect(() => aplicarCupomFrete(frete, [], 'FRETE4')).toThrow(/inválido/);
  });
});
