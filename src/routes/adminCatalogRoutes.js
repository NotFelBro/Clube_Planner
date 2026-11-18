const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/product');
const Category = require('../models/Category');
const { protegerAdmin, executarAdmin } = require('../middlewares/adminProtection');
const { validarOrigem } = require('../middlewares/validarOrigem');
const router = express.Router();
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const executar = (fn) => async (req, res, next) => {
  try { await executarAdmin(() => fn(req, res)); } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Slug ou SKU já cadastrado.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ success: false, message: 'Revise os campos obrigatórios, preços, estoque e SKUs.' });
    next(error);
  }
};
router.use(protegerAdmin);
router.get('/catalog', executar(async (req, res) => {
  const [registros, categorias] = await Promise.all([Product.find().sort({ updatedAt: -1 }).maxTimeMS(5000).lean(), Category.find().sort({ nome: 1 }).maxTimeMS(5000).lean()]);
  const produtos = registros
    .filter(produto => Array.isArray(produto.variacoes) && produto.variacoes.length > 0 &&
      produto.variacoes.every(variacao => typeof variacao?.sku === 'string'))
    .map(produto => ({ ...produto, imagens: produto.imagens ?? [] }));
  res.json({ success: true, data: { produtos, categorias, registrosInvalidos: registros.length - produtos.length } });
}));
router.use((req, res, next) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? validarOrigem(req, res, next) : next());
for (const [path, Model] of [['categories', Category], ['products', Product]]) {
  router.post(`/${path}`, executar(async (req, res) => {
    const data = await preparar(req.body, Model);
    const criar = async session => {
      const registro = session ? (await Model.create([data], { session }))[0] : await Model.create(data);
      await require('../services/adminService').registrar(req.auth.userId, `${path}.criacao`, registro._id || 'novo', `${registro.nome || data.nome} criado`, session);
      return registro;
    };
    const registro = req.auth.userId ? await mongoose.connection.transaction(criar) : await criar();
    res.status(201).json({ success: true, data: { registro } });
  }));
  router.put(`/${path}/:id`, executar(async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw invalid('Identificador inválido.');
    const registro = await Model.findById(req.params.id);
    if (!registro) return res.status(404).json({ success: false, message: 'Registro não encontrado.' });
    // Alterações de estoque concorrentes não podem ser sobrescritas por um formulário antigo.
    if (typeof req.body?.updatedAt !== 'string' || new Date(req.body.updatedAt).getTime() !== registro.updatedAt.getTime()) return res.status(409).json({ success: false, message: 'O registro foi alterado. Recarregue os dados antes de editar.' });
    const data = await preparar(req.body, Model, registro);
    registro.set(data);
    await registro.validate();
    const atualizar = async session => {
      const atualizado = await Model.findOneAndUpdate({ _id: registro._id, updatedAt: new Date(req.body.updatedAt) }, { $set: data }, { returnDocument: 'after', runValidators: true, session });
      if (!atualizado) throw Object.assign(new Error('O registro foi alterado. Recarregue os dados.'), { statusCode: 409 });
      await require('../services/adminService').registrar(req.auth.userId, `${path}.edicao`, registro._id, `${data.nome} atualizado`, session);
      return atualizado;
    };
    const atualizado = req.auth.userId ? await mongoose.connection.transaction(atualizar) : await atualizar();
    if (!atualizado) return res.status(409).json({ success: false, message: 'O registro foi alterado. Recarregue os dados.' });
    res.json({ success: true, data: { registro: atualizado } });
  }));
}
async function preparar(body, Model, anterior) {
  if (!body || typeof body !== 'object') throw invalid('Cadastro inválido.');
  const { nome, slug, descricao, ativo } = body;
  if (typeof nome !== 'string' || typeof slug !== 'string' || typeof descricao !== 'string' || typeof ativo !== 'boolean') throw invalid('Preencha nome, slug, descrição e status.');
  const data = { nome, slug, descricao, ativo };
  if (body.shippingCouponLevel !== undefined) {
    if (![null, 1, 2, 3].includes(body.shippingCouponLevel)) throw invalid("Nível de cupom inválido.");
    data.shippingCouponLevel = body.shippingCouponLevel;
  }
  if (Model === Category) return data;
  if (!mongoose.isObjectIdOrHexString(body.categoriaId) || !await Category.exists({ _id: body.categoriaId })) throw invalid('Selecione uma categoria existente.');
  if (!Array.isArray(body.imagens) || body.imagens.length > 12 || body.imagens.some(url => {
    try { return typeof url !== 'string' || url.length > 2048 || !(url.startsWith('/products/') && !url.includes('..') || ['https:', 'http:'].includes(new URL(url).protocol)); } catch { return true; }
  })) throw invalid('Informe até 12 imagens com URLs HTTP ou HTTPS válidas.');
  if (!Array.isArray(body.variacoes) || !body.variacoes.length || body.variacoes.length > 100) throw invalid('Informe entre 1 e 100 variações.');
  const recebidos = new Set(body.variacoes.map(v => String(v?._id || "")));
  if (anterior?.variacoes.some(v => v.estoqueReservado > 0 && !recebidos.has(String(v._id)))) throw invalid("Não é possível remover uma variação com estoque reservado.");
  const ids = new Set();
  data.variacoes = await Promise.all(body.variacoes.map(async v => {
    if (!v || typeof v.sku !== 'string' || typeof v.ativo !== 'boolean' || !Number.isSafeInteger(v.precoCentavos) || v.precoCentavos < 0 || !Number.isSafeInteger(v.estoqueDisponivel) || v.estoqueDisponivel < 0) throw invalid('Preço e estoque devem ser inteiros não negativos.');
    const existente = anterior?.variacoes.id(v._id);
    if (v._id && (!existente || ids.has(String(v._id)))) throw invalid('Variação inválida.');
    if (v._id) ids.add(String(v._id));
    if (!v.atributos || typeof v.atributos !== 'object' || Array.isArray(v.atributos) || Object.entries(v.atributos).some(([k, val]) => !k.trim() || /[.$]/.test(k) || ['__proto__', 'constructor', 'prototype'].includes(k) || typeof val !== 'string' || !val.trim())) throw invalid('Atributos inválidos.');
    if (v.precoOriginalCentavos != null && (!Number.isSafeInteger(v.precoOriginalCentavos) || v.precoOriginalCentavos < v.precoCentavos)) throw invalid('Preço original deve ser maior ou igual ao preço de venda.');
    const lojaId = existente?.lojaId || (anterior && !existente ? await require('../services/catalogIdentityService').proximoId() : undefined);
    return { ...(existente ? { _id: existente._id } : {}), ...(lojaId ? { lojaId } : {}), precoOriginalCentavos: v.precoOriginalCentavos ?? null, sku: v.sku, atributos: v.atributos, precoCentavos: v.precoCentavos, estoqueDisponivel: v.estoqueDisponivel, estoqueReservado: existente?.estoqueReservado || 0, ativo: v.ativo };
  }));
  if (anterior?.variacoes.some(v => v.estoqueReservado > 0 && !ids.has(String(v._id)))) throw invalid('Não é possível remover uma variação com estoque reservado.');
  return { ...data, categoriaId: body.categoriaId, imagens: body.imagens };
}
module.exports = router;
