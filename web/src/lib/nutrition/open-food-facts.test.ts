import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeProduct, prioritizeMexico } from './open-food-facts.ts';

test('normaliza valores disponibles y conserva los ausentes como null', () => {
  const result = normalizeProduct({ code: '12345678', product_name_es: 'Frijoles', brands: 'Marca', nutriments: { proteins_100g: 5, fat_100g: 0, 'energy-kcal_100g': -1 } });
  assert.equal(result?.name, 'Frijoles');
  assert.equal(result?.proteinG, 5);
  assert.equal(result?.fatG, 0);
  assert.equal(result?.energyKcal, null);
  assert.equal(result?.carbohydratesG, null);
  assert.equal(normalizeProduct({ code: 'no', product_name: 'Ejemplo' }), null);
});

test('acepta fotos oficiales y rechaza imágenes de otros dominios', () => {
  const product = { code: '12345678', product_name: 'Ejemplo', nutriments: {} };
  assert.equal(normalizeProduct({ ...product, image_front_small_url: 'https://images.openfoodfacts.org/images/products/123/456/78/front_es.3.200.jpg' })?.photoUrl,
    'https://images.openfoodfacts.org/images/products/123/456/78/front_es.3.200.jpg');
  assert.equal(normalizeProduct({ ...product, image_front_small_url: 'https://evil.example/a.jpg' })?.photoUrl, null);
});

test('muestra alérgenos, trazas y etiquetas sin asumir ausencia cuando faltan', () => {
  const item = normalizeProduct({ code: '12345678', product_name: 'Ejemplo', allergens_tags: ['en:milk', 'en:peanuts', 'en:milk', 1], traces_tags: ['en:soybeans'], labels_tags: ['es:exceso-de-calorias'] });
  assert.deepEqual(item?.allergens, ['Leche', 'Cacahuate']);
  assert.deepEqual(item?.traces, ['Soya']);
  assert.deepEqual(item?.labels, ['exceso de calorias']);
  assert.deepEqual(normalizeProduct({ code: '12345678', product_name: 'Ejemplo' })?.allergens, []);
});

test('prioriza productos reportados en México sin descartar los demás', () => {
  const product = (code: string, countries_tags?: string[]) => normalizeProduct({ code, product_name: code, countries_tags })!;
  const items = [product('1111', ['en:france']), product('2222'), product('3333', ['en:mexico']), product('4444', ['en:mexico'])];
  assert.deepEqual(prioritizeMexico(items).map(item => item.id), ['off:3333', 'off:4444', 'off:1111', 'off:2222']);
  assert.deepEqual(items.map(item => item.id), ['off:1111', 'off:2222', 'off:3333', 'off:4444']);
  assert.equal(items[0].mexico, false);
  assert.equal(items[1].mexico, null);
});
