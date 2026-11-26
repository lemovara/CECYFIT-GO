import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { suggestIngredients } from './ingredient-suggestions.ts';

const foods = [{ id: '1', name: 'Pollo, pechuga sin piel' }, { id: '2', name: 'Aceite de oliva' },
  { id: '3', name: 'Tomate rojo', original_name: 'Tomato raw' }, { id: '4', name: 'Pollo entero' }];

test('sugiere por palabras completas, acentos y nombres originales', () => {
  assert.deepEqual(suggestIngredients('2 pechugas pollo sin piel', foods).map(food => food.id), ['1', '4']);
  assert.equal(suggestIngredients('tomato', foods)[0].id, '3');
  assert.equal(suggestIngredients('1 cucharada de aceite de oliva', foods)[0].id, '2');
  assert.deepEqual(suggestIngredients('1 taza de agua', foods), []);
  assert.deepEqual(suggestIngredients('chocolate', foods), []);
});

test('limita resultados y no altera el catálogo', () => {
  assert.equal(suggestIngredients('pollo', foods, 1).length, 1);
  assert.equal(foods.length, 4);
});
