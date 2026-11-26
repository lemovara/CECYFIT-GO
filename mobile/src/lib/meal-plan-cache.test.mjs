import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadMealPlan, MealNetworkError } from './meal-plan-cache-core.ts';

function cache() {
  const data = new Map();
  const key = (user, patient, week) => JSON.stringify([user, patient, week]);
  return {
    async read(user, patient, week) { return data.get(key(user, patient, week)) ?? null; },
    async write(user, patient, week, plan) { data.set(key(user, patient, week), plan); },
  };
}
const week = '2026-11-23';
const disconnected = async () => { throw new MealNetworkError('sin red'); };

test('muestra la última semana guardada solo para la cuenta y ficha correspondientes', async () => {
  const storage = cache();
  await loadMealPlan(storage, 'u1', 'p1', week, async () => [{ id: 'a', name: 'Tacos' }]);
  const result = await loadMealPlan(storage, 'u1', 'p1', week, disconnected);
  assert.equal(result.offline, true);
  assert.equal(result.meals[0].name, 'Tacos');
  await assert.rejects(loadMealPlan(storage, 'u2', 'p1', week, disconnected), MealNetworkError);
  await assert.rejects(loadMealPlan(storage, 'u1', 'p2', week, disconnected), MealNetworkError);
  await assert.rejects(loadMealPlan(storage, 'u1', 'p1', '2026-11-30', disconnected), MealNetworkError);
});

test('no muestra datos guardados cuando el servidor rechaza el acceso', async () => {
  const storage = cache();
  await loadMealPlan(storage, 'u1', 'p1', week, async () => [{ id: 'a' }]);
  await assert.rejects(loadMealPlan(storage, 'u1', 'p1', week, async () => { throw new Error('permisos'); }), /permisos/);
});

test('una respuesta antigua no reemplaza un menú más reciente guardado', async () => {
  const storage = cache();
  let finish;
  const slow = loadMealPlan(storage, 'u1', 'p1', week, () => new Promise(resolve => { finish = resolve; }));
  await loadMealPlan(storage, 'u1', 'p1', week, async () => [{ id: 'nuevo' }]);
  finish([{ id: 'antiguo' }]);
  await slow;
  const result = await loadMealPlan(storage, 'u1', 'p1', week, disconnected);
  assert.equal(result.meals[0].id, 'nuevo');
});

test('una falla de escritura local no bloquea la consulta en línea', async () => {
  const storage = { async read() { return null; }, async write() { throw new Error('sin almacenamiento'); } };
  const result = await loadMealPlan(storage, 'u1', 'p1', week, async () => [{ id: 'a' }]);
  assert.equal(result.offline, false);
  assert.equal(result.meals[0].id, 'a');
});
