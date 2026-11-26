import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mealSuggestions } from './meal-suggestions.ts';
test('ofrece al menos 100 nombres de platillos distintos', () => {
  assert.ok(mealSuggestions.length >= 100);
  assert.equal(new Set(mealSuggestions).size, mealSuggestions.length);
});
