import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculateNutrition, optimizeRecipe } from './engine.ts';

test('calcula porciones y conserva datos desconocidos', () => {
  const result = calculateNutrition([{ id: 'pollo', grams: 200, nutrients: { protein: 20, fat: 2, energy: null } }], 2);
  assert.equal(result.protein.known, 20);
  assert.equal(result.fat.known, 2);
  assert.equal(result.energy.complete, false);
  assert.deepEqual(result.energy.missing, ['pollo']);
  assert.throws(() => calculateNutrition([{ id: 'x', grams: -1, nutrients: {} }], 1));
});

test('no aplica ajustes menores al incremento para alcanzar un límite', () => {
  const result = optimizeRecipe([{ id: 'x', grams: 100, min: 100, max: 107, step: 5, locked: false, nutrients: { protein: 100 } }], { protein: 107 });
  assert.equal(result.ingredients[0].grams, 105);
  assert.equal(result.converged, true);
});

test('avisa cuando se agota el límite de iteraciones sin afirmar que la meta es imposible', () => {
  const result = optimizeRecipe([{ id: 'x', grams: 1000, min: 1000, max: 5000, step: 1, locked: false, nutrients: { protein: 100 } }], { protein: 5000 });
  assert.equal(result.converged, false);
  assert.match(result.notice, /límite de iteraciones/);
});

test('propone gramos dentro de límites y respeta ingredientes bloqueados', () => {
  const items = [
    { id: 'pollo', grams: 100, min: 50, max: 200, step: 10, locked: false, nutrients: { protein: 20, fat: 4 } },
    { id: 'aceite', grams: 10, min: 0, max: 20, step: 1, locked: true, nutrients: { protein: 0, fat: 100 } },
  ];
  const result = optimizeRecipe(items, { protein: 30, fat: 16 });
  assert.ok(result.ingredients[0].grams > 100 && result.ingredients[0].grams <= 200);
  assert.equal(result.ingredients[1].grams, 10);
  assert.equal(result.totals.fat.known, 10 + result.ingredients[0].grams * .04);
  assert.ok(optimizeRecipe(items, { protein: 1000 }).unmet.includes('protein'));
  assert.throws(() => optimizeRecipe([{ ...items[0], nutrients: { protein: null } }], { protein: 10 }));
});
