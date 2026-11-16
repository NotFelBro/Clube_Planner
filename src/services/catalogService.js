const Product = require('../models/product');
const Category = require('../models/Category');
const samples = require('../../shared/sampleProducts.json');
const legacy = require('./sampleCatalogService');
const {
  AuthError
} = require('./authService');
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function inicializarCatalogo({
  estoqueInicial = 100
} = {}) {
  if (process.env.NODE_ENV === "production") {
    for (const produto of await Product.find({
      "variacoes.lojaId": {
        $exists: false
      }
    })) await produto.save();
    return;
  }
  for (const categoria of [...new Set(samples.map(p => p.category))]) {
    const exemplo = samples.find(p => p.category === categoria);
    await Category.updateOne({
      slug: categoria
    }, {
      $setOnInsert: {
        nome: exemplo.categoryName,
        slug: categoria,
        descricao: '',
        ativo: true
      }
    }, {
      upsert: true
    });
  }
  for (const sample of samples) {
    const existente = await Product.exists({
      $or: [{
        _id: legacy.productId(sample.id)
      }, {
        'variacoes.lojaId': sample.id
      }, {
        slug: slug(sample.name)
      }]
    });
    if (existente) continue;
    const categoria = await Category.findOne({
      slug: sample.category
    }).select('_id');
    try {
      await Product.create({
        _id: legacy.productId(sample.id),
        nome: sample.name,
        slug: slug(sample.name),
        descricao: sample.description,
        categoriaId: categoria._id,
        ativo: true,
        imagens: sample.images?.map(i => i.src) || [sample.image],
        shippingCouponLevel: sample.shippingCouponLevel || null,
        variacoes: [{
          _id: legacy.variantId(sample.id),
          lojaId: sample.id,
          sku: `TESTE-${sample.id}`,
          atributos: {
            Modelo: sample.model || sample.name
          },
          precoCentavos: Math.round(sample.price * 100),
          precoOriginalCentavos: sample.originalPrice ? Math.round(sample.originalPrice * 100) : null,
          estoqueDisponivel: estoqueInicial,
          estoqueReservado: 0,
          ativo: true
        }]
      });
    } catch (erro) {
      if (erro.code !== 11000) throw erro;
    }
  }
  // Preserva produtos administrativos anteriores e atribui IDs de vitrine às suas variações.
  for (const produto of await Product.find({
    'variacoes.lojaId': {
      $exists: false
    }
  })) await produto.save();
}
async function catalogo({
  interno = false
} = {}) {
  const config = legacy.configuracao();
  const categorias = await Category.find({
    ativo: true
  }).select('_id nome slug').sort({
    nome: 1
  }).lean();
  const categoriasPorId = new Map(categorias.map(c => [String(c._id), c]));
  const produtos = await Product.find({
    ativo: true,
    categoriaId: {
      $in: categorias.map(c => c._id)
    }
  }).sort({
    createdAt: 1
  }).lean();
  const itens = produtos.flatMap(produto => produto.variacoes.filter(v => v.ativo && v.lojaId).map(variacao => {
    const original = samples.find(p => p.id === variacao.lojaId) || {};
    const categoria = categoriasPorId.get(String(produto.categoriaId));
    const imagens = produto.imagens.map((src, i) => ({
      src,
      alt: `${produto.nome} — imagem ${i + 1}`
    }));
    const preco = variacao.precoCentavos;
    const referencia = Math.max(preco, variacao.precoOriginalCentavos ?? preco);
    const atributos = Object.entries(variacao.atributos || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
    return {
      ...original,
      ...(interno ? {
        precoCatalogoCentavos: variacao.precoCentavos,
        precoReferenciaCentavos: variacao.precoOriginalCentavos ?? null,
        categoriaId: String(produto.categoriaId)
      } : {}),
      id: variacao.lojaId,
      productId: String(produto._id),
      variantId: String(variacao._id),
      sku: variacao.sku,
      name: produto.nome + (produto.variacoes.length > 1 ? ` · ${atributos || variacao.sku}` : ''),
      description: produto.descricao,
      detailDescription: produto.descricao,
      category: categoria.slug,
      categoryName: categoria.nome,
      model: atributos || original.model || '',
      stock: variacao.estoqueDisponivel,
      price: config.modo === 'gratuito' ? 0 : preco / 100,
      originalPrice: config.modo === 'gratuito' ? 0 : referencia / 100,
      discount: config.modo === 'gratuito' || referencia === 0 ? 0 : Math.round((referencia - preco) / referencia * 100),
      image: imagens[0]?.src || original.image || '/products/placeholder.svg',
      images: imagens.length ? imagens : original.images || [],
      shippingCouponLevel: produto.shippingCouponLevel,
      background: original.background || '#E8F1E8'
    };
  }));
  const {
    configuracaoPublica
  } = require('./storeSettingsService');
  return {
    ...config,
    produtos: itens,
    categorias: categorias.map(c => ({
      id: c.slug,
      name: c.nome
    })),
    loja: await configuracaoPublica()
  };
}
function normalizarItens(itens, produtos) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 100) throw new AuthError('Carrinho vazio ou inválido.');
  const vistos = new Set();
  return itens.map(item => {
    if (!Number.isSafeInteger(item?.id) || item.id < 1 || produtos && !produtos.some(p => p.id === item.id) || vistos.has(item?.id) || !Number.isSafeInteger(item?.quantidade) || item.quantidade < 1 || item.quantidade > 99) throw new AuthError('Produto ou quantidade inválidos.');
    vistos.add(item.id);
    return {
      id: item.id,
      quantidade: item.quantidade
    };
  }).sort((a, b) => a.id - b.id);
}
module.exports = {
  inicializarCatalogo,
  catalogo,
  normalizarItens
};
