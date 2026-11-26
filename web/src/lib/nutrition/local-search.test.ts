import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { searchLocalFoods } from './local-search.ts';

test('busca sin acentos y por sinónimos sin confundir tipos', () => {
  const items = [
    { id: 'j', type: 'food' as const, name: 'Jitomate crudo', terms: [] },
    { id: 'p', type: 'recipe' as const, name: 'Pollo con brócoli', terms: ['pollo', 'brócoli'] },
  ];
  assert.equal(searchLocalFoods(items, 'tomate rojo', 'food')[0].id, 'j');
  assert.equal(searchLocalFoods(items, 'BROCOLI', 'recipe')[0].id, 'p');
  assert.equal(searchLocalFoods(items, 'pollo', 'food').length, 0);
});

test('busca también por el nombre original de un ingrediente', () => {
  const items = [{ id: '1', type: 'food' as const, name: 'Avena integral', terms: ['Whole grain oats'] }];
  assert.equal(searchLocalFoods(items, 'grain oats', 'food')[0].id, '1');
  assert.equal(searchLocalFoods(items, 'quinoa', 'food').length, 0);
});

test('expande sinónimos incluidos en frases sin confundir tomate verde', () => {
  const items = [
    { id: '1', type: 'recipe' as const, name: 'Pollo con jitomate', terms: [] },
    { id: '2', type: 'recipe' as const, name: 'Pollo con tomate verde', terms: [] },
  ];
  assert.deepEqual(searchLocalFoods(items, 'pollo con tomate rojo', 'recipe').map(item => item.id), ['1']);
  assert.deepEqual(searchLocalFoods(items, 'pollo con tomatillo', 'recipe').map(item => item.id), ['2']);
});
