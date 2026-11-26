import type { ExtraMeal, Meal } from './patient-meals';

type Nutrient = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
type Total = { known: number; missing: number };
const nutrients: Nutrient[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

/** Summarizes only assigned meals; additional foods have a separate log. */
export function summarizeMeals(meals: Meal[], pendingMealIds: Set<string>) {
  const confirmed = meals.filter(meal => meal.status === 'CONSUMED' && !pendingMealIds.has(meal.id));
  function totals(list: Meal[]) {
    return Object.fromEntries(nutrients.map(nutrient => {
      const total: Total = { known: 0, missing: 0 };
      for (const meal of list) {
        const value = nutrient === 'kcal' ? meal.kcal : meal.recipe?.[nutrient];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) total.known += value;
        else total.missing++;
      }
      return [nutrient, total];
    })) as Record<Nutrient, Total>;
  }
  return { planned: totals(meals), confirmed: totals(confirmed), confirmedCount: confirmed.length,
    pendingCount: meals.filter(meal => pendingMealIds.has(meal.id)).length };
}

/** Pending IDs take precedence over server copies to avoid double counting during synchronization. */
export function summarizeExtras(remote: ExtraMeal[], pending: ExtraMeal[]) {
  const pendingIds = new Set(pending.map(item => item.id));
  const confirmed = remote.filter(item => !pendingIds.has(item.id));
  function totals(items: ExtraMeal[]) {
    return Object.fromEntries(nutrients.map(nutrient => {
      const total: Total = { known: 0, missing: 0 };
      for (const item of items) {
        const value = nutrient === 'kcal' ? item.kcal : item.nutrition_snapshot?.[nutrient];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) total.known += value;
        else total.missing++;
      }
      return [nutrient, total];
    })) as Record<Nutrient, Total>;
  }
  return { confirmed: totals(confirmed), pending: totals(pending), confirmedCount: confirmed.length, pendingCount: pending.length };
}

/** Only sources whose pending operations are known can contribute to confirmed intake. */
export function summarizeConfirmedIntake(
  meals: Meal[] | null, pendingMealIds: Set<string> | null,
  remoteExtras: ExtraMeal[] | null, pendingExtras: ExtraMeal[] | null,
) {
  const mealsAvailable = meals !== null && pendingMealIds !== null;
  const extrasAvailable = remoteExtras !== null && pendingExtras !== null;
  const mealSummary = mealsAvailable ? summarizeMeals(meals, pendingMealIds) : null;
  const extraSummary = extrasAvailable ? summarizeExtras(remoteExtras, pendingExtras) : null;
  const totals = Object.fromEntries(nutrients.map(nutrient => [nutrient, {
    known: (mealSummary?.confirmed[nutrient].known ?? 0) + (extraSummary?.confirmed[nutrient].known ?? 0),
    missing: (mealSummary?.confirmed[nutrient].missing ?? 0) + (extraSummary?.confirmed[nutrient].missing ?? 0),
  }])) as Record<Nutrient, Total>;
  return { totals, mealsAvailable, extrasAvailable,
    pendingCount: (mealSummary?.pendingCount ?? 0) + (extraSummary?.pendingCount ?? 0),
    confirmedCount: (mealSummary?.confirmedCount ?? 0) + (extraSummary?.confirmedCount ?? 0) };
}
