export type CatalogFood = {
  kind: 'food'; id: string; name: string; photo_url: string | null; source_name: string | null; source_url: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
};
export type CatalogRecipe = {
  kind: 'recipe'; id: string; name: string; photo_url: string | null; source_name: string; source_url: null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  ingredients: { id: string; name: string; grams: number }[]; description: string;
};
export type CatalogProduct = {
  kind: 'product'; id: string; name: string; brand: string | null; photo_url: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  allergens?: string[]; traces?: string[]; labels?: string[];
  mexico?: boolean | null;
};
export type CatalogItem = CatalogFood | CatalogRecipe | CatalogProduct;
export type FoodSnapshot = {
  version: 1; kind?: 'food' | 'recipe' | 'product' | 'manual'; food_id: string; food_name: string; grams?: number; recipes?: number;
  amount?: number; unit?: 'g' | 'ml'; brand?: string | null;
  allergens?: string[]; traces?: string[]; labels?: string[];
  consumed_time?: string; time_zone?: 'America/Mexico_City';
  ingredients?: { id: string; name: string; grams: number }[];
  source_name: string | null; source_url: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
};

/** The associated meal_date supplies the date; do not infer a time for past entries. */
export function withIntakeTime(snapshot: FoodSnapshot | undefined, name: string, kcal: number | null, time: string): FoodSnapshot | undefined {
  const trimmed = time.trim();
  if (!trimmed) return snapshot;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) throw new Error('Hora inválida');
  return { ...(snapshot ?? { version: 1, kind: 'manual', food_id: 'manual', food_name: name,
    source_name: 'Registro manual', source_url: null, kcal, protein: null, carbs: null, fat: null, fiber: null }),
    consumed_time: trimmed, time_zone: 'America/Mexico_City' };
}

export function estimateFood(food: CatalogFood, grams: number): FoodSnapshot {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) throw new Error('Gramaje inválido');
  const scale = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * grams) / 100 : null;
  return { version: 1, kind: 'food', food_id: food.id, food_name: food.name, grams, source_name: food.source_name, source_url: food.source_url,
    kcal: scale(food.kcal), protein: scale(food.protein), carbs: scale(food.carbs), fat: scale(food.fat), fiber: scale(food.fiber) };
}

/** The catalog has no serving count; the multiplier is for the complete listed recipe. */
export function estimateRecipe(recipe: CatalogRecipe, recipes: number): FoodSnapshot {
  if (!Number.isFinite(recipes) || recipes <= 0 || recipes > 20) throw new Error('Cantidad inválida');
  const scale = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * recipes * 100) / 100 : null;
  return { version: 1, kind: 'recipe', food_id: recipe.id, food_name: recipe.name, recipes, source_name: recipe.source_name, source_url: null,
    ingredients: recipe.ingredients.map(item => ({ id: item.id, name: item.name, grams: Math.round(item.grams * recipes * 100) / 100 })),
    kcal: scale(recipe.kcal), protein: scale(recipe.protein), carbs: scale(recipe.carbs), fat: scale(recipe.fat), fiber: scale(recipe.fiber) };
}

export function estimateProduct(product: CatalogProduct, amount: number, unit: 'g' | 'ml'): FoodSnapshot {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000 || (unit !== 'g' && unit !== 'ml')) throw new Error('Cantidad inválida');
  const scale = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * amount) / 100 : null;
  return { version: 1, kind: 'product', food_id: product.id, food_name: product.name, brand: product.brand, amount, unit,
    allergens: product.allergens ?? [], traces: product.traces ?? [], labels: product.labels ?? [],
    source_name: 'Open Food Facts', source_url: 'https://world.openfoodfacts.org', kcal: scale(product.kcal),
    protein: scale(product.protein), carbs: scale(product.carbs), fat: scale(product.fat), fiber: scale(product.fiber) };
}
