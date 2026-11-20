import { supabase } from './supabase';

export type MealStatus = 'CONSUMED' | 'SKIPPED';
export type Ingredient = { id: string; name: string; grams: number; photo_url: string | null };
export type Recipe = {
  id: string; title: string; description: string; photo_url: string | null;
  kcal: number; protein: number; carbs: number; fat: number; fiber: number;
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
  recipe: Recipe | null;
};

export type ExtraMeal = {
  id: string;
  name: string;
  portion: string;
  kcal: number | null;
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
  const query = supabase.from('patient_meals')
    .select('id,meal_date,scheduled_time,name,ingredients,notes,kcal,recipe_id,meal_logs(status)')
    .eq('patient_id', patientId);
  const { data, error } = await ('date' in filter
    ? query.eq('meal_date', filter.date).order('scheduled_time')
    : 'id' in filter ? query.eq('id', filter.id)
    : query.gte('meal_date', filter.from).lte('meal_date', filter.to).order('meal_date').order('scheduled_time'));
  if (error) throw error;
  const recipeIds = [...new Set(data.map((entry) => entry.recipe_id).filter(Boolean))];
  let recipes: Recipe[] = [];
  if (recipeIds.length) {
    const catalog = await supabase.from('recipe_catalog').select('*').in('id', recipeIds);
    if (catalog.error) throw catalog.error;
    recipes = catalog.data as Recipe[];
  }

  return data.map(({ meal_logs, recipe_id, ...meal }) => ({
    ...meal,
    status: (meal_logs[0]?.status ?? null) as MealStatus | null,
    recipe: recipes.find(({ id }) => id === recipe_id) ?? null,
  })) as Meal[];
}

export async function saveMealStatus(mealId: string, status: MealStatus) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('record_meal_status', { target_meal_id: mealId, meal_status: status });
  if (error) throw error;
}

export async function readExtraMeals(patientId: string, date: string): Promise<ExtraMeal[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('extra_meal_logs').select('id,name,portion,kcal')
    .eq('patient_id', patientId).eq('meal_date', date).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveExtraMeal(patientId: string, date: string, entry: ExtraMeal) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('record_extra_meal', {
    p_request_id: entry.id,
    p_patient_id: patientId,
    p_meal_date: date,
    p_name: entry.name,
    p_portion: entry.portion,
    p_kcal: entry.kcal,
  });
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
