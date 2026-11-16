import { it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const catalog = require('../src/services/sampleCatalogService');
afterEach(() => vi.unstubAllEnvs());
it('uses both test prices consistently in the server catalog', () => {
  vi.stubEnv('CHECKOUT_TEST_MODE', 'mercado_pago');
  const { produtos } = catalog.catalogo();
  expect(produtos).toHaveLength(12);
  expect(produtos.filter(p => (p.originalPrice ?? p.price) === 1)).toHaveLength(6);
  expect(produtos.filter(p => (p.originalPrice ?? p.price) === 0.5)).toHaveLength(6);
  for (const produto of produtos) {
    const original = produto.originalPrice ?? produto.price;
    expect(Math.round(produto.price * 100)).toBe(Math.round(original * 100 * (1 - produto.discount / 100)));
  }
  expect(produtos.every(p => Number.isSafeInteger(p.price * 100))).toBe(true);
});
it('keeps the optional free simulation mode', () => {
  vi.stubEnv('CHECKOUT_TEST_MODE', 'gratuito');
  expect(catalog.catalogo().produtos.every(p => p.price === 0)).toBe(true);
});
