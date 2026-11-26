import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { compareGroceryBranches, quoteGroceries } from './grocery-quote.ts';

test('consolida las cantidades de las recetas asignadas, no las de la plantilla', () => {
  const ingredient = { id: 'avena', name: 'Avena', photo_url: null };
  const first = { id: '1', recipe: { ingredients: [{ ...ingredient, grams: 80 }] } };
  const second = { id: '2', recipe: { ingredients: [{ ...ingredient, grams: 120 }] } };
  const result = quoteGroceries([first, second], [{ ingredient_id: 'avena', pack_grams: 500, pack_price: 50, sold_by_weight: false, observed_on: '2026-01-01' }]);
  assert.equal(result.items[0].ingredient.grams, 200);
  assert.equal(result.consumed, 2000);
  assert.equal(result.purchase, 5000);
  assert.equal(result.complete, true);
});

test('consolida productos comerciales por unidad sin inventar precios ni mezclar gramos y mililitros', () => {
  const product = { id: 'off:12345678', kind: 'product', amount: 100, unit: 'g', brand: 'Ejemplo', photo_url: null, ingredients: [] };
  const meals = [{ id: '1', name: 'Producto', recipe: product }, { id: '2', name: 'Producto', recipe: { ...product, amount: 150 } },
    { id: '3', name: 'Producto', recipe: { ...product, unit: 'ml', amount: 50 } }];
  const result = quoteGroceries(meals, []);
  assert.equal(result.products.length, 2);
  assert.equal(result.products.find(item => item.unit === 'g').amount, 250);
  assert.equal(result.products.find(item => item.unit === 'ml').amount, 50);
  assert.equal(result.complete, false);
  assert.equal(result.manualMeals, 0);
  assert.ok(result.mealsWithCost.every(item => item.cost === null));
});

test('cotiza presentaciones completas sin mezclar unidades y calcula consumo proporcional', () => {
  const product = { id: 'off:12345678', kind: 'product', amount: 250, unit: 'g', brand: null, photo_url: null, ingredients: [] };
  const meals = [{ id: '1', name: 'Producto', recipe: product }];
  const price = { product_id: product.id, unit: 'g', pack_amount: 200, pack_price: 30, observed_on: '2026-11-26' };
  const quote = quoteGroceries(meals, [], [price]);
  assert.equal(quote.consumed, 3750);
  assert.equal(quote.purchase, 6000);
  assert.equal(quote.products[0].packages, 2);
  assert.equal(quote.complete, true);
  assert.equal(quote.mealsWithCost[0].cost, 3750);
  assert.equal(quoteGroceries(meals, [], [{ ...price, unit: 'ml' }]).complete, false);
  const comparison = compareGroceryBranches(meals, [], [], [{ ...price, store: 'Walmart', branch: 'centro' }]);
  assert.equal(comparison[0].quote.purchase, 6000);
});

test('compara solo totales completos y prioriza el precio personal de la misma sucursal', () => {
  const meals = [{ id: '1', recipe: { ingredients: [
    { id: 'avena', name: 'Avena', grams: 100, photo_url: null },
    { id: 'leche', name: 'Leche', grams: 100, photo_url: null },
  ] } }];
  const row = (store, branch, ingredient_id, pack_price) => ({ store, branch, ingredient_id, pack_price, pack_grams: 100, sold_by_weight: false, observed_on: '2026-01-01' });
  const reference = [row('Soriana', 'a', 'avena', 1), row('Walmart', 'b', 'avena', 10), row('Walmart', 'b', 'leche', 10), row('Chedraui', 'c', 'avena', 15), row('Chedraui', 'c', 'leche', 15)];
  const compared = compareGroceryBranches(meals, reference, [row('Chedraui', 'c', 'avena', 1)]);
  assert.equal(compared[0].store, 'Chedraui');
  assert.equal(compared[0].quote.purchase, 1600);
  assert.equal(compared[1].store, 'Walmart');
  assert.equal(compared[2].store, 'Soriana');
  assert.equal(compared[2].quote.complete, false);
});

test('una receta propia asignada consolida ingredientes y conserva precio desconocido', () => {
  const first = { id: '1', recipe: { ingredients: [
    { id: 'avena', name: 'Avena seca', grams: 50, photo_url: null },
    { id: 'platano', name: 'Plátano', grams: 100, photo_url: null },
  ] } };
  const second = { id: '2', recipe: { ingredients: [{ id: 'avena', name: 'Avena seca', grams: 75, photo_url: null }] } };
  const result = quoteGroceries([first, second], [{ ingredient_id: 'avena', pack_grams: 500, pack_price: 40, sold_by_weight: false, observed_on: '2026-01-01' }]);
  assert.equal(result.items.find(row => row.ingredient.id === 'avena').ingredient.grams, 125);
  assert.equal(result.items.find(row => row.ingredient.id === 'platano').consumed, null);
  assert.equal(result.missing, 1);
  assert.equal(result.complete, false);
  assert.equal(result.mealsWithCost[0].cost, null);
});

test('una receta sin ingredientes impide presentar un total como completo', () => {
  const meals = [
    { id: '1', recipe: { ingredients: [{ id: 'avena', name: 'Avena', grams: 100, photo_url: null }] } },
    { id: '2', recipe: { ingredients: [] } },
  ];
  const result = quoteGroceries(meals, [{ ingredient_id: 'avena', pack_grams: 500, pack_price: 50, sold_by_weight: false, observed_on: '2026-01-01' }]);
  assert.equal(result.manualMeals, 1);
  assert.equal(result.complete, false);
  assert.equal(result.purchase, 5000);
  assert.equal(result.mealsWithCost[1].cost, null);
});
