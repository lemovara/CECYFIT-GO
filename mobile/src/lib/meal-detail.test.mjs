import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadMealDetail, MealNetworkError } from './meal-plan-cache-core.ts';

test('usa la comida consultada previamente solo cuando falla la red', async () => {
  const cached = { id: 'comida' };
  assert.deepEqual(await loadMealDetail(async () => { throw new MealNetworkError('offline'); }, cached), { meal: cached, offline: true });
  await assert.rejects(loadMealDetail(async () => { throw new Error('acceso revocado'); }, cached), /acceso revocado/);
  await assert.rejects(loadMealDetail(async () => { throw new MealNetworkError('offline'); }), /offline/);
  assert.deepEqual(await loadMealDetail(async () => undefined, cached), { meal: undefined, offline: false });
});
