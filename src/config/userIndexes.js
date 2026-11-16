const specs = [
  { campo: 'email', nome: 'email_ativo_unico', parcial: { ativo: true, email: { $type: 'string' } } },
  { campo: 'cpf', nome: 'cpf_ativo_unico', parcial: { ativo: true, cpf: { $type: 'string' } } },
];
async function garantirIndicesUsuario(collection, { migrarLegados = false } = {}) {
  let indices;
  try { indices = await collection.indexes(); } catch (error) { if (error.code !== 26) throw error; indices = []; }
  const chave = (i, campo) => i.key?.[campo] === 1 && Object.keys(i.key).length === 1;
  for (const spec of specs) {
    const valido = i => chave(i, spec.campo) && i.unique === true && !i.sparse && JSON.stringify(i.partialFilterExpression) === JSON.stringify(spec.parcial);
    if (!indices.some(valido)) {
      await collection.createIndex({ [spec.campo]: 1 }, { name: spec.nome, unique: true, partialFilterExpression: spec.parcial });
    }
  }
  // As duas novas garantias precisam estar confirmadas antes de remover qualquer índice anterior.
  const atuais = await collection.indexes();
  for (const spec of specs) {
    if (!atuais.some(i => chave(i, spec.campo) && i.unique && JSON.stringify(i.partialFilterExpression) === JSON.stringify(spec.parcial))) throw new Error('Não foi possível confirmar os índices únicos dos usuários ativos.');
  }
  const legados = atuais.filter(i => i.unique === true && specs.some(s => chave(i, s.campo)) && !specs.some(s => i.unique && chave(i, s.campo) && JSON.stringify(i.partialFilterExpression) === JSON.stringify(s.parcial)));
  for (const indice of legados) {
    const conhecido = ['email_1', 'cpf_1', 'cpf_preenchido_unico'].includes(indice.name) && indice.unique === true && !indice.sparse && (!indice.partialFilterExpression || JSON.stringify(indice.partialFilterExpression) === JSON.stringify({ cpf: { $type: 'string' } }));
    if (!migrarLegados || !conhecido) throw new Error('Índice legado de usuário precisa de migração explícita.');
  }
  for (const indice of legados) await collection.dropIndex(indice.name);
}
module.exports = { garantirIndicesUsuario };
