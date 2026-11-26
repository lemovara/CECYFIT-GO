import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { summarizeConfirmedIntake, summarizeExtras, summarizeMeals } from './meal-day-summary.ts';

test('suma el plan y únicamente los consumos confirmados sin ocultar datos faltantes', () => {
  const meals = [
    { id: '1', status: 'CONSUMED', kcal: 300, recipe: { protein: 20, carbs: 30, fat: 10, fiber: 3 } },
    { id: '2', status: 'CONSUMED', kcal: 100, recipe: null },
    { id: '3', status: null, kcal: null, recipe: null },
  ];
  const result = summarizeMeals(meals, new Set(['2']));
  assert.deepEqual(result.planned.kcal, { known: 400, missing: 1 });
  assert.deepEqual(result.planned.protein, { known: 20, missing: 2 });
  assert.deepEqual(result.confirmed.kcal, { known: 300, missing: 0 });
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.pendingCount, 1);
});

test('combina consumos confirmados sin sumar pendientes ni inventar nutrientes', () => {
  const meals = [{ id: '1', status: 'CONSUMED', kcal: 300, recipe: { protein: 20, carbs: 30, fat: 10, fiber: null } },
    { id: '2', status: 'CONSUMED', kcal: 400, recipe: null }];
  const remote = [{ id: 'a', kcal: 150, nutrition_snapshot: { protein: 5, carbs: 10, fat: 2, fiber: 1 } },
    { id: 'b', kcal: 80 }];
  const result = summarizeConfirmedIntake(meals, new Set(['2']), remote, [{ id: 'b', kcal: 80 }]);
  assert.deepEqual(result.totals.kcal, { known: 450, missing: 0 });
  assert.deepEqual(result.totals.protein, { known: 25, missing: 0 });
  assert.deepEqual(result.totals.fiber, { known: 1, missing: 1 });
  assert.equal(result.pendingCount, 2);
  assert.equal(result.confirmedCount, 2);
});

test('no suma una fuente si su cola no se pudo comprobar', () => {
  const result = summarizeConfirmedIntake([{ id: '1', status: 'CONSUMED', kcal: 300 }], null,
    [{ id: 'a', kcal: 150 }], null);
  assert.equal(result.mealsAvailable, false);
  assert.equal(result.extrasAvailable, false);
  assert.equal(result.confirmedCount, 0);
});

test('no duplica un adicional si el servidor lo recibió antes de limpiar la cola', () => {
  const remote = [{ id: 'x', kcal: 200, nutrition_snapshot: { protein: 3 } }, { id: 'y', kcal: null }];
  const pending = [{ id: 'x', kcal: 200, nutrition_snapshot: { protein: 3 } }];
  const result = summarizeExtras(remote, pending);
  assert.deepEqual(result.confirmed.kcal, { known: 0, missing: 1 });
  assert.deepEqual(result.pending.kcal, { known: 200, missing: 0 });
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.pendingCount, 1);
});
