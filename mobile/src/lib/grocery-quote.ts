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
export type ProductPrice = { product_id: string; unit: 'g' | 'ml'; pack_amount: number; pack_price: number; observed_on: string };

export function quoteGroceries(meals: Meal[], prices: MarketPrice[], productPrices: ProductPrice[] = []) {
  const requirements = new Map<string, Ingredient>();
  const products = new Map<string, { id: string; name: string; brand: string | null; photo_url: string | null; amount: number; unit: 'g' | 'ml' }>();
  const priceById = new Map(prices.map((price) => [price.ingredient_id, price]));
  const productPriceById = new Map(productPrices.map(price => [`${price.product_id}:${price.unit}`, price]));
  let manualMeals = 0;
  const mealsWithCost = meals.map((meal) => {
    const recipe = meal.recipe;
    const isProduct = recipe?.kind === 'product' && typeof recipe.id === 'string' && /^off:\d{4,24}$/.test(recipe.id)
      && typeof recipe.amount === 'number' && Number.isFinite(recipe.amount) && recipe.amount > 0 && (recipe.unit === 'g' || recipe.unit === 'ml');
    if (isProduct) {
      const unit = recipe.unit!;
      const key = `${recipe.id}:${unit}`;
      const previous = products.get(key);
      products.set(key, { id: recipe.id, name: meal.name, brand: recipe.brand ?? null, photo_url: meal.photo_url || recipe.photo_url,
        amount: (previous?.amount ?? 0) + recipe.amount!, unit });
    } else if (!recipe?.ingredients?.length) manualMeals++;
    let cost = 0;
    let complete = Boolean(meal.recipe?.ingredients?.length);
    if (isProduct) {
      const productPrice = productPriceById.get(`${recipe.id}:${recipe.unit}`);
      if (productPrice) { cost += recipe.amount! * Math.round(productPrice.pack_price * 100) / productPrice.pack_amount; complete = true; }
    }
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
  const quotedProducts = [...products.values()].sort((a, b) => a.name.localeCompare(b.name, 'es-MX')).map(product => {
    const price = productPriceById.get(`${product.id}:${product.unit}`);
    if (!price) return { ...product, price: undefined, consumed: null, purchase: null, packages: null };
    const packageCost = Math.round(price.pack_price * 100);
    const packages = Math.ceil(product.amount / price.pack_amount);
    return { ...product, price, consumed: Math.round(product.amount * packageCost / price.pack_amount), purchase: packages * packageCost, packages };
  });
  const missingProducts = quotedProducts.filter(product => !product.price).length;
  return {
    items, products: quotedProducts, mealsWithCost, manualMeals, missing, missingProducts,
    consumed: items.reduce((sum, item) => sum + (item.consumed ?? 0), 0) + quotedProducts.reduce((sum, item) => sum + (item.consumed ?? 0), 0),
    purchase: items.reduce((sum, item) => sum + (item.purchase ?? 0), 0) + quotedProducts.reduce((sum, item) => sum + (item.purchase ?? 0), 0),
    complete: items.length + products.size > 0 && missing === 0 && manualMeals === 0 && missingProducts === 0,
  };
}

export type BranchPrice = MarketPrice & { store: Store; branch: string; display_branch?: string; municipality?: string };
export type BranchProductPrice = ProductPrice & { store: Store; branch: string };
export function compareGroceryBranches(meals: Meal[], reference: BranchPrice[], personal: BranchPrice[], productPrices: BranchProductPrice[] = []) {
  const groups = new Map<string, { store: Store; branch: string; display: string; prices: Map<string, MarketPrice>; products: ProductPrice[] }>();
  for (const [rows, source] of [[reference, 'PROFECO'], [personal, 'personal']] as const) {
    for (const row of rows) {
      const key = JSON.stringify([row.store, row.branch]);
      let group = groups.get(key);
      if (!group) {
        group = { store: row.store, branch: row.branch, display: row.display_branch || row.branch, prices: new Map(), products: [] };
        groups.set(key, group);
      }
      group.prices.set(row.ingredient_id, { ...row, source });
    }
  }
  for (const price of productPrices) {
    const key = JSON.stringify([price.store, price.branch]);
    let group = groups.get(key);
    if (!group) { group = { store: price.store, branch: price.branch, display: price.branch, prices: new Map(), products: [] }; groups.set(key, group); }
    group.products.push(price);
  }
  return [...groups.values()].map(group => ({ ...group, quote: quoteGroceries(meals, [...group.prices.values()], group.products) }))
    .sort((a, b) => Number(b.quote.complete) - Number(a.quote.complete) ||
      (a.quote.complete && b.quote.complete ? a.quote.purchase - b.quote.purchase : (a.quote.missing + a.quote.missingProducts) - (b.quote.missing + b.quote.missingProducts)) ||
      a.store.localeCompare(b.store, 'es-MX') || a.display.localeCompare(b.display, 'es-MX'));
}
