const catalog = require('./sampleCatalogService');
const { AuthError } = require('./authService');

function aplicarCupomFrete(frete, itens, codigo, produtos = catalog.catalogo().produtos) {
  if (codigo == null || codigo === '') return frete;
  if (typeof codigo !== 'string' || !/^FRETE[123]$/.test(codigo)) throw new AuthError('Cupom de frete inválido.');
  const nivel = Number(codigo.slice(-1));
  const normalizados = require("./catalogService").normalizarItens(itens, produtos);
  if (!normalizados.some(item => produtos.find(p => p.id === item.id)?.shippingCouponLevel === nivel)) {
    throw new AuthError('Este cupom exige um produto participante na compra.');
  }
  if (frete.nivel !== nivel) throw new AuthError(`Este cupom é válido apenas para entrega de nível ${nivel}. Escolha o cupom correspondente ao CEP.`);
  return { ...frete, valorOriginalCentavos: frete.valorCentavos, descontoCentavos: frete.valorCentavos, valorCentavos: 0, cupom: codigo };
}
module.exports = { aplicarCupomFrete };
