import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeRecipe, normalizeRecipeDetail, normalizeSpanishRecipeHtml, searchTerm } from './myplate.ts';

test('adapta términos comunes conservando palabras desconocidas', () => {
  assert.equal(searchTerm('Pollo con arroz'), 'chicken rice');
  assert.equal(searchTerm('tacos'), 'tacos');
  assert.equal(searchTerm('Ensalada de atún y jitomate'), 'salad tuna tomato');
  assert.equal(searchTerm('Calabacita con frijoles'), 'zucchini beans');
});

test('muestra ingredientes y preparación originales sin inventar gramajes', () => {
  const value = normalizeRecipeDetail({ ingredients: [{ text: '1 cup water', note: null }, { text: '2 eggs', note: 'large' }], directions: 'Mix and cook.', yield: '4 servings' });
  assert.deepEqual(value?.ingredients, [{ text: '1 cup water', note: null }, { text: '2 eggs', note: 'large' }]);
  assert.equal(value?.servings, '4 servings');
  assert.equal(normalizeRecipeDetail({ ingredients: [], directions: 'Cook' }), null);
});
test('usa enlaces en español y rechaza destinos e imágenes ajenas', () => {
  const value = normalizeRecipe({ slug: 'chicken-rice', name: 'Chicken Rice', locales: { es: 'https://myplate.food/es/recipes/pollo-con-arroz' }, image_url: 'https://example.com/x.jpg' });
  assert.equal(value?.title, 'Pollo con arroz');
  assert.equal(value?.photo, null);
  assert.equal(normalizeRecipe({ slug: 'x', name: 'Test', locales: { es: 'https://other.test/es/recipes/x' } }), null);
});

test('acepta imágenes del proveedor compatibles con la asignación y rechaza enlaces manipulados', () => {
  const base = { slug: '2-step-chicken', name: 'Chicken', locales: { es: 'https://myplate.food/es/recipes/pollo-en-2-pasos' } };
  assert.equal(normalizeRecipe({ ...base, image_url: 'https://recipe-images.myplate.food/recipe-images/2-step-chicken.jpg' })?.photo,
    'https://recipe-images.myplate.food/recipe-images/2-step-chicken.jpg');
  assert.equal(normalizeRecipe({ ...base, image_url: 'https://recipe-images.myplate.food/recipe-images/test.jpg?x=1' })?.photo, null);
  assert.equal(normalizeRecipe({ ...base, image_url: 'https://recipe-images.myplate.food.evil.test/recipe-images/test.jpg' })?.photo, null);
});

test('lee la receta estructurada en español y verifica idioma y dirección', () => {
  const url = 'https://myplate.food/es/recipes/pollo-en-2-pasos';
  const recipe = { '@type': 'Recipe', url, inLanguage: 'es-MX', recipeYield: '4 porciones',
    recipeIngredient: ['2 pechugas de pollo', '1/2 taza de agua'], recipeInstructions: [{ text: 'Cocina el pollo.' }, { text: 'Agrega agua.' }] };
  const html = `<script type="application/ld+json">${JSON.stringify(recipe)}</script>`;
  const result = normalizeSpanishRecipeHtml(html, url);
  assert.equal(result?.language, 'es');
  assert.equal(result?.ingredients[1].text, '1/2 taza de agua');
  assert.equal(result?.directions, 'Cocina el pollo.\nAgrega agua.');
  assert.equal(normalizeSpanishRecipeHtml(html, `${url}-otra`), null);
  assert.equal(normalizeSpanishRecipeHtml(html.replace('es-MX', 'en-US'), url), null);
  assert.equal(normalizeSpanishRecipeHtml('<script type="application/ld+json">mal</script>', url), null);
});
