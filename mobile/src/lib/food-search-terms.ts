import type { CatalogRecipe } from './extra-food';
import type { Meal } from './patient-meals';

const aliases = [
  ['jitomate', 'tomate rojo'], ['tomate verde', 'tomatillo'], ['aguacate', 'palta'],
  ['elote', 'maíz tierno'], ['frijol', 'poroto'], ['calabacita', 'calabacín'],
];
const normalize = (value: string) => value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

/** Escape PostgREST filter syntax before inserting user input into an OR expression. */
export function localFoodSearchTerms(input: string): string[] {
  const safe = input.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (safe.length < 2) return [];
  const key = normalize(safe);
  const group = aliases.find(entries => entries.some(entry => normalize(entry) === key));
  if (group) return group;
  const results = new Set([safe]);
  for (const entries of aliases) {
    for (const entry of entries) {
      const pattern = new RegExp(`(^| )${normalize(entry)}(?= |$)`, 'g');
      if (pattern.test(key)) {
        for (const alternative of entries) results.add(key.replace(pattern, (_, prefix: string) => prefix + alternative));
      }
    }
  }
  return [...results].slice(0, 6);
}
/** Uses only meal snapshots already available for the selected patient and week. */
export function searchCachedMeals(meals: Meal[], query: string): CatalogRecipe[] {
  const terms = localFoodSearchTerms(query).map(normalize);
  if (!terms.length) return [];
  return meals.flatMap(meal => {
    const recipe = meal.recipe;
    if (!recipe || !Array.isArray(recipe.ingredients)) return [];
    const text = normalize([meal.name, ...recipe.ingredients.map(item => item.name)].join(' '));
    if (!terms.some(term => term.split(' ').every(word => text.includes(word)))) return [];
    return [{ kind: 'recipe' as const, id: `assigned:${meal.id}`, name: meal.name,
      photo_url: meal.photo_url || recipe.photo_url, source_name: 'Comida asignada guardada', source_url: null,
      description: meal.notes || recipe.description || '', kcal: meal.kcal, protein: recipe.protein,
      carbs: recipe.carbs, fat: recipe.fat, fiber: recipe.fiber, ingredients: recipe.ingredients }];
  }).slice(0, 30);
}
