import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { portionGrams } from './recipe-portions.ts';

test('escala los gramos de la receta para las porciones asignadas', () => {
  assert.equal(portionGrams(600, 4, 1), 150);
  assert.equal(portionGrams(600, 4, 1.5), 225);
  assert.equal(portionGrams(100, 3, 1), 33.3);
  assert.equal(portionGrams(100, 1, 1), 100);
});

test('rechaza valores ausentes, extremos o que se redondean a cero', () => {
  for (const args of [[0, 4, 1], [NaN, 4, 1], [100, 0, 1], [100, 1.5, 1], [100, 4, 0], [5000, 1, 2], [0.1, 100, 1]]) {
    assert.equal(portionGrams(args[0], args[1], args[2]), null);
  }
});
