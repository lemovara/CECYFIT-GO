import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { localFoodSearchTerms, searchCachedMeals } from './food-search-terms.ts';

test('busca sinónimos de uso mexicano sin mezclar tomate verde y jitomate', () => {
  assert.deepEqual(localFoodSearchTerms('Tomate rojo'), ['jitomate', 'tomate rojo']);
  assert.deepEqual(localFoodSearchTerms('TOMATILLO'), ['tomate verde', 'tomatillo']);
  assert.deepEqual(localFoodSearchTerms('palta'), ['aguacate', 'palta']);
  assert.ok(localFoodSearchTerms('Pollo con tomate rojo').includes('pollo con jitomate'));
  assert.deepEqual(localFoodSearchTerms('tomate verde'), ['tomate verde', 'tomatillo']);
});

test('busca en instantáneas asignadas y conserva las cantidades personalizadas', () => {
  const meals = [{ id: 'a', name: 'Pollo con arroz', kcal: 400, notes: '', photo_url: null,
    recipe: { photo_url: null, description: '', protein: 20, carbs: 40, fat: 8, fiber: 2,
      ingredients: [{ id: 'arroz', name: 'Arroz', grams: 120 }] } }];
  const result = searchCachedMeals(meals, 'arroz');
  assert.equal(result.length, 1);
  assert.equal(result[0].ingredients[0].grams, 120);
  assert.equal(result[0].id, 'assigned:a');
  assert.equal(searchCachedMeals(meals, 'pescado').length, 0);
});

test('el texto no puede introducir operadores en el filtro de búsqueda', () => {
  assert.deepEqual(localFoodSearchTerms('pollo),id.eq.1'), ['pollo id eq 1']);
  assert.deepEqual(localFoodSearchTerms('%_'), []);
});
