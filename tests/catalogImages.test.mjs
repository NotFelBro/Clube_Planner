import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { products, mergeCatalogImages } from '../frontend/src/data/products.js';

it('keeps all twelve images when an older API omits image paths', () => {
  const remote = products.map(({ image, images, ...product }) => ({ ...product, price: 123 }));
  const merged = mergeCatalogImages(remote);
  expect(merged).toHaveLength(12);
  for (const product of merged) {
    expect(product.price).toBe(123);
    expect(product.image).toMatch(/^\/products\/.+\.png$/);
    const path = `frontend/public${product.image}`;
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});

it('preserves the planner gallery when the API has no secondary images', () => {
  const planner = mergeCatalogImages([{ id: 1, name: 'Planner Semanal' }])[0];
  expect(planner.images).toHaveLength(8);
  expect(planner.images[0].src).toBe(planner.image);
  expect(new Set(planner.images.map(image => image.src)).size).toBe(8);
  for (const image of planner.images) {
    expect(existsSync(`frontend/public${image.src}`)).toBe(true);
    expect(image.alt).toBeTruthy();
  }
});
