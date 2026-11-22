import type { Ingredient, Meal } from './patient-meals';

export const stores = ['Soriana', 'Walmart', 'Chedraui', 'Bodega Aurrera', 'Sam’s Club'] as const;
export type Store = typeof stores[number];
export type MarketPrice = {
  ingredient_id: string; pack_grams: number; pack_price: number;
  sold_by_weight: boolean; observed_on: string;
  source?: 'PROFECO' | 'personal';
  presentation?: string;
  brand?: string;
};

export function quoteGroceries(meals: Meal[], prices: MarketPrice[]) {
  const requirements = new Map<string, Ingredient>();
  const priceById = new Map(prices.map((price) => [price.ingredient_id, price]));
  let manualMeals = 0;
  const mealsWithCost = meals.map((meal) => {
    if (!meal.recipe) manualMeals++;
    let cost = 0;
    let complete = Boolean(meal.recipe?.ingredients.length);
    for (const ingredient of meal.recipe?.ingredients ?? []) {
      const previous = requirements.get(ingredient.id);
      requirements.set(ingredient.id, { ...ingredient, grams: (previous?.grams ?? 0) + ingredient.grams });
      const price = priceById.get(ingredient.id);
      if (price) cost += (ingredient.grams * Math.round(price.pack_price * 100)) / price.pack_grams;
      else complete = false;
    }
    return { meal, cost: complete ? Math.round(cost) : null };
  });

  const items = [...requirements.values()].sort((a, b) => a.name.localeCompare(b.name, 'es-MX')).map((ingredient) => {
    const price = priceById.get(ingredient.id);
    if (!price) return { ingredient, price: undefined, consumed: null, purchase: null, packages: null };
    const packageCost = Math.round(price.pack_price * 100);
    const consumed = Math.round((ingredient.grams * packageCost) / price.pack_grams);
    const packages = price.sold_by_weight ? null : Math.ceil(ingredient.grams / price.pack_grams);
    return { ingredient, price, consumed, purchase: packages === null ? consumed : packages * packageCost, packages };
  });
  const missing = items.filter(({ price }) => !price).length;
  return {
    items, mealsWithCost, manualMeals, missing,
    consumed: items.reduce((sum, item) => sum + (item.consumed ?? 0), 0),
    purchase: items.reduce((sum, item) => sum + (item.purchase ?? 0), 0),
    complete: items.length > 0 && missing === 0 && manualMeals === 0,
  };
}
