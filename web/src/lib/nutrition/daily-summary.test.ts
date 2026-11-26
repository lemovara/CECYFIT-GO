import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { summarizeDay } from './daily-summary.ts';

test('distingue consumo planificado, adicional y diferencias cuando están completos', () => {
  const result = summarizeDay([{ id: 'a', kcal: 400 }, { id: 'b', kcal: 300 }], [
    { meal_id: 'a', status: 'CONSUMED' }, { meal_id: 'b', status: 'SKIPPED' },
  ], [{ kcal: 100 }]);
  assert.equal(result.planned.known, 700);
  assert.equal(result.reportedPlan.known, 400);
  assert.equal(result.extras?.known, 100);
  assert.equal(result.difference, -200);
});

test('no calcula una diferencia si faltan registros, datos o consulta adicional', () => {
  const meals = [{ id: 'a', kcal: 400 }, { id: 'b', kcal: null }];
  assert.equal(summarizeDay(meals, [], []).difference, null);
  assert.equal(summarizeDay(meals, [{ meal_id: 'a', status: 'CONSUMED' }, { meal_id: 'b', status: 'SKIPPED' }], []).difference, null);
  assert.equal(summarizeDay([{ id: 'a', kcal: 0 }], [{ meal_id: 'a', status: 'CONSUMED' }], null).difference, null);
  assert.equal(summarizeDay([{ id: 'a', kcal: 0 }], [{ meal_id: 'a', status: 'CONSUMED' }], []).difference, 0);
  assert.equal(summarizeDay([{ id: 'a', kcal: 100 }], [{ meal_id: 'a', status: 'CONSUMED' }, { meal_id: 'a', status: 'SKIPPED' }], []).reportedPlan.known, 100);
});

test('compara macronutrientes guardados del plan con el consumo adicional', () => {
  const result = summarizeDay([
    { id: 'a', kcal: 400, nutrition_snapshot: { protein: 20, carbs: 30, fat: 10, fiber: 4 } },
    { id: 'b', kcal: 300, nutrition_snapshot: { protein: 30, carbs: 20, fat: 5, fiber: 1 } },
  ], [{ meal_id: 'a', status: 'CONSUMED' }, { meal_id: 'b', status: 'SKIPPED' }], [
    { kcal: 100, nutrition_snapshot: { protein: 5, carbs: 10, fat: 0, fiber: null } },
  ]);
  assert.equal(result.nutrients.protein.planned.known, 50);
  assert.equal(result.nutrients.protein.actual?.known, 25);
  assert.equal(result.nutrients.protein.difference, -25);
  assert.equal(result.nutrients.fat.extras?.known, 0);
  assert.equal(result.nutrients.fiber.actual?.missing, 1);
  assert.equal(result.nutrients.fiber.difference, null);
});

test('no inventa macros para comidas manuales o registros incompletos', () => {
  const result = summarizeDay([
    { id: 'a', kcal: 200, nutrition_snapshot: { protein: 0, carbs: '12', fat: -1 } },
    { id: 'b', kcal: 100 },
  ], [{ meal_id: 'a', status: 'CONSUMED' }], [{ kcal: 70 }]);
  assert.equal(result.nutrients.protein.planned.known, 0);
  assert.equal(result.nutrients.protein.planned.missing, 1);
  assert.equal(result.nutrients.protein.actual?.missing, 1);
  assert.equal(result.nutrients.carbs.planned.missing, 2);
  assert.equal(result.nutrients.fat.planned.missing, 2);
  assert.equal(result.nutrients.protein.difference, null);
  assert.equal(result.unregistered, 1);
  assert.equal(summarizeDay([{ id: 'a', kcal: 1, nutrition_snapshot: { protein: 0 } }],
    [{ meal_id: 'a', status: 'CONSUMED' }], []).nutrients.protein.difference, 0);
  assert.equal(summarizeDay([{ id: 'a', kcal: 1, nutrition_snapshot: { protein: 1 } }],
    [{ meal_id: 'a', status: 'CONSUMED' }], null).nutrients.protein.actual, null);
});
