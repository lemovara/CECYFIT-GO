import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createFoodSearchHandler, normalizeProduct } from './handler.ts';

test('conserva valores desconocidos y rechaza imágenes de otros dominios', () => {
  const value = normalizeProduct({ code: '12345678', product_name_es: 'Leche', image_front_small_url: 'https://example.com/a.jpg',
    nutriments: { proteins_100g: 3.5, fat_100g: 0 } });
  assert.equal(value.kcal, null);
  assert.equal(value.protein, 3.5);
  assert.equal(value.fat, 0);
  assert.equal(value.photo_url, null);
  assert.equal(normalizeProduct({ product_name: 'Sin identificador' }), null);
});

test('incluye alérgenos, trazas y etiquetas declarados sin inventar datos', () => {
  const value = normalizeProduct({ code: '12345678', product_name_es: 'Leche', allergens_tags: ['en:milk', 'en:milk'], traces_tags: ['en:soybeans'], labels_tags: ['es:exceso-de-calorias'] });
  assert.deepEqual(value.allergens, ['Leche']);
  assert.deepEqual(value.traces, ['Soya']);
  assert.deepEqual(value.labels, ['exceso de calorias']);
  assert.deepEqual(normalizeProduct({ code: '12345678', product_name_es: 'Leche' }).allergens, []);
});

test('solicita países y coloca México primero dentro de la página', async () => {
  let requested;
  const handle = createFoodSearchHandler(async url => {
    requested = new URL(String(url));
    return Response.json({ count: 2, products: [
      { code: '1111', product_name: 'Uno', countries_tags: ['en:france'] },
      { code: '2222', product_name: 'Dos', countries_tags: ['en:mexico'] },
    ] });
  });
  const response = await handle(new Request('https://local.test', { method: 'POST', body: JSON.stringify({ query: 'leche' }) }));
  const data = await response.json();
  assert.ok(requested.searchParams.get('fields').includes('countries_tags'));
  assert.deepEqual(data.products.map(product => product.id), ['off:2222', 'off:1111']);
  assert.equal(data.products[0].mexico, true);
});

test('limita búsquedas, usa caché y no envía datos de la solicitud aparte de la consulta', async () => {
  const seen = [];
  const fetcher = async url => { seen.push(String(url)); return Response.json({ count: 0, products: [] }); };
  const handle = createFoodSearchHandler(fetcher, () => 1000);
  const request = (query, extra = {}) => new Request('https://local.test', { method: 'POST', body: JSON.stringify({ query, ...extra }) });
  assert.equal((await handle(request('avena', { patient: 'no-debe-salir' }))).status, 200);
  assert.equal((await handle(request('avena'))).status, 200);
  assert.equal(seen.length, 1);
  assert.ok(!seen[0].includes('no-debe-salir'));
  for (let i = 0; i < 7; i++) assert.equal((await handle(request(`alimento ${i}`))).status, 200);
  assert.equal((await handle(request('otra consulta'))).status, 429);
  assert.equal((await handle(request('a'))).status, 400);
});

test('una falla externa responde sin inventar productos', async () => {
  const handle = createFoodSearchHandler(async () => { throw new Error('offline'); });
  const response = await handle(new Request('https://local.test', { method: 'POST', body: JSON.stringify({ query: 'leche' }) }));
  assert.equal(response.status, 502);
  assert.ok(!(await response.json()).products);
});

test('ante falla externa devuelve solo una copia reciente e indica su fecha', async () => {
  let time = 1000, available = true;
  const handle = createFoodSearchHandler(async () => {
    if (!available) throw new Error('sin proveedor');
    return Response.json({ count: 1, products: [{ code: '12345678', product_name_es: 'Avena' }] });
  }, () => time);
  const request = () => new Request('https://local.test', { method: 'POST', body: JSON.stringify({ query: 'avena' }) });
  const initial = await (await handle(request())).json();
  assert.equal(initial.stale, false);
  available = false; time += 16 * 60 * 1000;
  const fallback = await (await handle(request())).json();
  assert.equal(fallback.stale, true);
  assert.equal(fallback.savedAt, new Date(1000).toISOString());
  assert.equal(fallback.products[0].name, 'Avena');
  time += 24 * 60 * 60 * 1000;
  assert.equal((await handle(request())).status, 502);
});

test('no consulta al proveedor cuando la cuota compartida rechaza o falla', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json({ products: [] }); };
  const request = () => new Request('https://local.test', { method: 'POST', body: JSON.stringify({ query: 'avena' }) });
  const rejected = createFoodSearchHandler(fetcher, Date.now, async () => false);
  const failed = createFoodSearchHandler(fetcher, Date.now, async () => { throw new Error('offline'); });
  assert.equal((await rejected(request())).status, 429);
  assert.equal((await failed(request())).status, 503);
  assert.equal(calls, 0);
});
