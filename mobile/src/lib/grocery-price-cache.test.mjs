import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { GroceryPriceNetworkError, loadGroceryPrices } from './grocery-price-cache-core.ts';

function memoryCache() {
  const data = new Map();
  const key = (user, patient) => JSON.stringify([user, patient]);
  return { async read(user, patient) { return structuredClone(data.get(key(user, patient)) ?? null); },
    async write(user, patient, value) { data.set(key(user, patient), structuredClone(value)); } };
}
const price = { ingredient_id: 'arroz', pack_grams: 1000, pack_price: 25, sold_by_weight: false, observed_on: '2026-11-20' };

test('recupera precios de la misma cuenta, ficha y sucursal solo tras falla de red', async () => {
  const cache = memoryCache();
  const online = await loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'centro', async () => ({ prices: [price], products: [] }));
  assert.equal(online.offline, false);
  const offline = () => { throw new GroceryPriceNetworkError('offline'); };
  assert.deepEqual((await loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'centro', offline)).prices, [price]);
  assert.equal((await loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'centro', offline)).offline, true);
  await assert.rejects(loadGroceryPrices(cache, 'u2', 'p1', 'Walmart', 'centro', offline));
  await assert.rejects(loadGroceryPrices(cache, 'u1', 'p2', 'Walmart', 'centro', offline));
  await assert.rejects(loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'otra', offline));
  await assert.rejects(loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'centro', () => { throw Error('sin permiso'); }));
});

test('una respuesta antigua no sustituye la sucursal seleccionada después', async () => {
  const cache = memoryCache();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = loadGroceryPrices(cache, 'u1', 'p1', 'Walmart', 'anterior', async () => { await gate; return { prices: [price], products: [] }; });
  await loadGroceryPrices(cache, 'u1', 'p1', 'Soriana', 'nueva', async () => ({ prices: [], products: [] }));
  release(); await first;
  assert.equal((await cache.read('u1', 'p1')).branch, 'nueva');
});
