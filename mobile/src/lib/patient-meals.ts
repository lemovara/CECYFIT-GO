import { supabase } from './supabase';

export type MealStatus = 'CONSUMED' | 'SKIPPED';
export type Meal = {
  id: string;
  meal_date: string;
  scheduled_time: string;
  name: string;
  ingredients: string;
  notes: string;
  kcal: number | null;
  status: MealStatus | null;
};

export function mealDate(offset = 0) {
  const mexicoDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date());
  const date = new Date(`${mexicoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function readMeals(patientId: string, filter: { date: string } | { id: string }): Promise<Meal[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const query = supabase.from('patient_meals')
    .select('id,meal_date,scheduled_time,name,ingredients,notes,kcal,meal_logs(status)')
    .eq('patient_id', patientId);
  const { data, error } = await ('date' in filter
    ? query.eq('meal_date', filter.date).order('scheduled_time')
    : query.eq('id', filter.id));
  if (error) throw error;

  return data.map(({ meal_logs, ...meal }) => ({
    ...meal,
    status: (meal_logs[0]?.status ?? null) as MealStatus | null,
  })) as Meal[];
}

export async function saveMealStatus(mealId: string, status: MealStatus) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('record_meal_status', { target_meal_id: mealId, meal_status: status });
  if (error) throw error;
}

export const mealStatusLabel = (status: MealStatus | null) =>
  status === 'CONSUMED' ? 'Consumida' : status === 'SKIPPED' ? 'No consumida' : 'Sin registro';
