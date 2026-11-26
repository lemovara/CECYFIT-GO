import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { estimateFood, estimateProduct, estimateRecipe, withIntakeTime } from './extra-food.ts';

const food = { id: 'avena', name: 'Avena seca', source_name: 'USDA', source_url: null, photo_url: null,
  kcal: 379, protein: 13.15, carbs: 67.7, fat: 6.52, fiber: null };

test('calcula la cantidad consumida y conserva la fuente y valores desconocidos', () => {
  const value = estimateFood(food, 50);
  assert.equal(value.kcal, 189.5);
  assert.equal(value.protein, 6.58);
  assert.equal(value.carbs, 33.85);
  assert.equal(value.fiber, null);
  assert.equal(value.source_name, 'USDA');
  assert.equal(value.food_id, 'avena');
});
test('rechaza cantidades inválidas', () => {
  for (const grams of [0, -1, 5001, NaN, Infinity]) assert.throws(() => estimateFood(food, grams));
});
test('escala la receta completa sin confundirla con una porción', () => {
  const recipe = { ...food, kind: 'recipe', source_name: 'Recetario', description: '',
    ingredients: [{ id: 'avena', name: 'Avena', grams: 50 }] };
  const half = estimateRecipe(recipe, 0.5);
  assert.equal(half.kcal, 189.5);
  assert.equal(half.ingredients[0].grams, 25);
  assert.equal(half.fiber, null);
  assert.equal(half.recipes, 0.5);
  assert.throws(() => estimateRecipe(recipe, 0));
});
test('calcula producto únicamente con la base indicada y conserva la fuente', () => {
  const product = { ...food, kind: 'product', id: 'off:1234', brand: 'Ejemplo', kcal: null, allergens: ['Leche'], traces: ['Soya'], labels: ['exceso de calorias'] };
  const value = estimateProduct(product, 200, 'ml');
  assert.equal(value.protein, 26.3);
  assert.equal(value.kcal, null);
  assert.equal(value.unit, 'ml');
  assert.equal(value.source_name, 'Open Food Facts');
  assert.deepEqual(value.allergens, ['Leche']);
  assert.deepEqual(value.traces, ['Soya']);
  assert.deepEqual(value.labels, ['exceso de calorias']);
  assert.throws(() => estimateProduct(product, 100, 'taza'));
});
test('conserva una hora declarada sin inventarla para registros manuales', () => {
  assert.equal(withIntakeTime(undefined, 'Tacos', null, ''), undefined);
  const manual = withIntakeTime(undefined, 'Tacos', 200, '08:05');
  assert.equal(manual.consumed_time, '08:05');
  assert.equal(manual.time_zone, 'America/Mexico_City');
  assert.equal(manual.protein, null);
  assert.equal(manual.kcal, 200);
  assert.throws(() => withIntakeTime(undefined, 'Tacos', null, '25:10'));
  assert.throws(() => withIntakeTime(undefined, 'Tacos', null, '12:60'));
});
