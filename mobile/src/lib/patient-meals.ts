import { supabase } from './supabase';
import { MealNetworkError } from './meal-plan-cache-core';
import { localFoodSearchTerms } from './food-search-terms';
import { withRequestTimeout } from './request-timeout';
import type { CatalogFood, CatalogItem, CatalogProduct, CatalogRecipe, FoodSnapshot } from './extra-food';

export type MealStatus = 'CONSUMED' | 'SKIPPED';
export type Ingredient = { id: string; name: string; grams: number; photo_url: string | null; source_name?: string | null; source_url?: string | null };
export type Recipe = {
  id: string; title: string; description: string; photo_url: string | null;
  kind?: 'product'; amount?: number; unit?: 'g' | 'ml'; brand?: string | null;
  allergens?: string[]; traces?: string[]; labels?: string[];
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  ingredients: Ingredient[];
};
export type Meal = {
  id: string;
  meal_date: string;
  scheduled_time: string;
  name: string;
  ingredients: string;
  notes: string;
  kcal: number | null;
  status: MealStatus | null;
  revision?: number;
  status_logged_at?: string | null;
  recipe: Recipe | null;
  photo_url: string | null;
};

export type ExtraMeal = {
  id: string;
  name: string;
  portion: string;
  kcal: number | null;
  revision?: number;
  nutrition_snapshot?: FoodSnapshot | null;
};

export function shiftMealDate(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function mealDate(offset = 0) {
  // Hermes may fall back to another locale, so assemble ISO from named parts.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return shiftMealDate(`${part('year')}-${part('month')}-${part('day')}`, offset);
}

export async function readMeals(patientId: string, filter: { date: string } | { id: string } | {
  from: string; to: string;
}): Promise<Meal[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
  const query = supabase.from('patient_meals')
    .select('id,meal_date,scheduled_time,name,ingredients,notes,kcal,photo_url,recipe_id,revision,nutrition_snapshot,meal_logs(status,logged_at)')
    .eq('patient_id', patientId).abortSignal(controller.signal);
  const { data, error, status } = await ('date' in filter
    ? query.eq('meal_date', filter.date).order('scheduled_time')
    : 'id' in filter ? query.eq('id', filter.id)
    : query.gte('meal_date', filter.from).lte('meal_date', filter.to).order('meal_date').order('scheduled_time'));
  if (error) { if (status === 0) throw new MealNetworkError('Sin conexión al consultar el menú.'); throw error; }
  const recipeIds = [...new Set(data.filter(entry => !entry.nutrition_snapshot).map((entry) => entry.recipe_id).filter(Boolean))];
  let recipes: Recipe[] = [];
  if (recipeIds.length) {
    const catalog = await supabase.from('recipe_catalog').select('*').in('id', recipeIds).abortSignal(controller.signal);
    if (catalog.error) { if (catalog.status === 0) throw new MealNetworkError('Sin conexión al consultar recetas.'); throw catalog.error; }
    recipes = catalog.data as Recipe[];
  }

  return data.map(({ meal_logs, recipe_id, nutrition_snapshot, ...meal }) => ({
    ...meal,
    status: (meal_logs[0]?.status ?? null) as MealStatus | null,
    status_logged_at: meal_logs[0]?.logged_at ?? null,
    recipe: (nutrition_snapshot as Recipe | null) ?? recipes.find(({ id }) => id === recipe_id) ?? null,
  })) as Meal[];
  } finally { clearTimeout(timeout); }
}

export async function saveMealStatus(mealId: string, status: MealStatus) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('record_meal_status', { target_meal_id: mealId, meal_status: status });
  if (error) throw error;
}

export async function readExtraMeals(patientId: string, date: string): Promise<ExtraMeal[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase.from('extra_meal_logs').select('id,name,portion,kcal,nutrition_snapshot,revision')
      .eq('patient_id', patientId).eq('meal_date', date).order('created_at', { ascending: false }).abortSignal(controller.signal);
    if (error) throw error;
    return data as ExtraMeal[];
  } finally { clearTimeout(timeout); }
}

export async function searchExtraFoods(term: string): Promise<{ items: CatalogItem[]; partial: boolean }> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const terms = localFoodSearchTerms(term);
  if (!terms.length) return { items: [], partial: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
  const [foods, recipes] = await Promise.all([
    supabase.rpc('search_catalog_ingredients', { p_terms: terms }).abortSignal(controller.signal),
    supabase.rpc('search_catalog_recipes', { p_terms: terms }).abortSignal(controller.signal),
  ]);
  if (foods.error && recipes.error) {
    if (foods.status === 0 && recipes.status === 0) throw new MealNetworkError('Sin conexión al consultar alimentos.');
    throw foods.error;
  }
  const ingredients = ((foods.data ?? []) as Omit<CatalogFood, 'kind'>[]).map(row => ({ ...row, kind: 'food' as const }));
  const dishes = ((recipes.data ?? []) as (Omit<CatalogRecipe, 'kind' | 'name' | 'source_name' | 'source_url'> & { title: string })[])
    .map(({ title, ...row }) => ({ ...row, name: title, kind: 'recipe' as const, source_name: 'Recetario CECYFIT', source_url: null }));
  return { items: [...dishes, ...ingredients], partial: Boolean(foods.error || recipes.error) };
  } finally { clearTimeout(timeout); }
}

export async function searchExtraProducts(query: string, page = 1): Promise<{ items: CatalogProduct[]; hasMore: boolean; stale: boolean; savedAt?: string }> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.functions.invoke('food-search', { body: { query: query.trim(), page } });
  if (error || !data || !Array.isArray(data.products)) throw error ?? new Error('Respuesta inválida');
  return { items: data.products.map((product: Omit<CatalogProduct, 'kind'>) => ({ ...product, kind: 'product' as const })), hasMore: data.hasMore === true, stale: data.stale === true, savedAt: typeof data.savedAt === 'string' ? data.savedAt : undefined };
}

export async function saveExtraMeal(patientId: string, date: string, entry: ExtraMeal) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const client = supabase;
  const { error } = await withRequestTimeout(signal => client.rpc(entry.nutrition_snapshot ? 'record_extra_food' : 'record_extra_meal', {
    p_request_id: entry.id,
    p_patient_id: patientId,
    p_meal_date: date,
    p_name: entry.name,
    p_portion: entry.portion,
    p_kcal: entry.kcal,
    ...(entry.nutrition_snapshot ? { p_nutrition_snapshot: entry.nutrition_snapshot } : {}),
  }).abortSignal(signal));
  if (error) throw error;
}

export async function deleteExtraMeal(patientId: string, date: string, id: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const client = supabase;
  const { data, error } = await withRequestTimeout(signal => client.from('extra_meal_logs').delete()
    .eq('patient_id', patientId).eq('meal_date', date).eq('id', id).select('id').abortSignal(signal));
  if (error || !data || data.length !== 1) throw error ?? new Error('El registro ya no está disponible.');
}

export async function correctExtraMeal(patientId: string, entry: ExtraMeal) {
  if (!supabase || !Number.isInteger(entry.revision)) throw new Error('Conéctate para actualizar el registro.');
  const client = supabase;
  const { error } = await withRequestTimeout(signal => client.rpc('correct_extra_food', {
    p_patient_id: patientId, p_id: entry.id, p_expected_revision: entry.revision,
    p_name: entry.name, p_portion: entry.portion, p_kcal: entry.kcal,
  }).abortSignal(signal));
  if (error) throw error;
}

export const mealStatusLabel = (status: MealStatus | null) =>
  status === 'CONSUMED' ? 'Consumida' : status === 'SKIPPED' ? 'No consumida' : 'Sin registro';

export function mealSaveError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === '42501') return 'Comprueba que tu ficha siga activa y que la comida pertenezca a tu dieta.';
  if (code === '22023' || code === '23514') return 'Revisa la fecha y los datos del consumo.';
  return 'No pudimos guardar el registro. Comprueba la conexión y reintenta.';
}
