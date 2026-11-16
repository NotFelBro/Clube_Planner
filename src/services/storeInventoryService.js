const Product = require('../models/product');
const {
  AuthError
} = require('./authService');
async function movimentar(pedido, acao, session) {
  if (!pedido.estoqueControlado) return;
  const atual = pedido.estoqueStatus;
  if (acao === 'recuperar' && atual !== 'liberado') return;
  if (acao === 'consumir' && atual !== 'reservado' || acao === 'liberar' && atual !== 'reservado' || acao === 'devolver' && atual !== 'consumido') return;
  for (const item of pedido.itens) {
    const filtro = {
      _id: item.productId,
      variacoes: {
        $elemMatch: {
          _id: item.variantId,
          ...(acao === 'recuperar' ? { estoqueDisponivel: { $gte: item.quantidade } } : atual === 'reservado' ? {
            estoqueReservado: {
              $gte: item.quantidade
            }
          } : {})
        }
      }
    };
    const inc = acao === 'recuperar' ? { 'variacoes.$.estoqueDisponivel': -item.quantidade } : acao === 'consumir' ? {
      'variacoes.$.estoqueReservado': -item.quantidade
    } : acao === 'liberar' ? {
      'variacoes.$.estoqueReservado': -item.quantidade,
      'variacoes.$.estoqueDisponivel': item.quantidade
    } : {
      'variacoes.$.estoqueDisponivel': item.quantidade
    };
    const resultado = await Product.updateOne(filtro, {
      $inc: inc
    }, {
      session
    });
    if (resultado.modifiedCount !== 1) throw new AuthError('Não foi possível atualizar a reserva de estoque. Tente novamente.', 409);
  }
  pedido.estoqueStatus = ['consumir', 'recuperar'].includes(acao) ? 'consumido' : 'liberado';
}
async function reservar(linhas, session) {
  for (const item of linhas) {
    if (!(await require('../models/Category').exists({
      _id: item.categoriaId,
      ativo: true
    }).session(session))) throw new AuthError('Categoria indisponível. Atualize sua sacola.', 409);
    const resultado = await Product.updateOne({
      _id: item.productId,
      ativo: true,
      categoriaId: item.categoriaId,
      shippingCouponLevel: item.cupomNivel ?? null,
      variacoes: {
        $elemMatch: {
          _id: item.variantId,
          ativo: true,
          precoCentavos: item.precoCatalogoCentavos,
          precoOriginalCentavos: item.precoReferenciaCentavos ?? null,
          estoqueDisponivel: {
            $gte: item.quantidade
          }
        }
      }
    }, {
      $inc: {
        'variacoes.$.estoqueDisponivel': -item.quantidade,
        'variacoes.$.estoqueReservado': item.quantidade
      }
    }, {
      session
    });
    if (resultado.modifiedCount !== 1) throw new AuthError('Produto indisponível, preço alterado ou estoque insuficiente. Atualize sua sacola.', 409);
  }
}
module.exports = {
  movimentar,
  reservar
};
