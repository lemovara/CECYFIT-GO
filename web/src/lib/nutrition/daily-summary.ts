type Meal = { id: string; kcal: number | null; nutrition_snapshot?: unknown };
type Log = { meal_id: string; status: 'CONSUMED' | 'SKIPPED' };
type Extra = { kcal: number | null; nutrition_snapshot?: unknown };
type Sum = { known: number; missing: number; count: number };
type Nutrient = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
type NutritionalItem = { kcal: number | null; nutrition_snapshot?: unknown };

function nutrientValue(item: NutritionalItem, nutrient: Nutrient): number | null {
  if (nutrient === 'kcal') return item.kcal;
  const snapshot = item.nutrition_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[nutrient];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function sumNutrient(items: NutritionalItem[], nutrient: Nutrient): Sum {
  return items.reduce<Sum>((sum, item) => {
    const value = nutrientValue(item, nutrient);
    if (value === null || !Number.isFinite(value) || value < 0) sum.missing++;
    else sum.known += value;
    sum.count++;
    return sum;
  }, { known: 0, missing: 0, count: 0 });
}

/** Calories are estimates from the stored plan and patient-reported entries. */
export function summarizeDay(meals: Meal[], logs: Log[], extraMeals: Extra[] | null) {
  // The query orders logs newest first; keep the same entry shown in the meal list.
  const status = new Map<string, Log['status']>();
  for (const log of logs) if (!status.has(log.meal_id)) status.set(log.meal_id, log.status);
  const consumed = meals.filter(meal => status.get(meal.id) === 'CONSUMED');
  const skipped = meals.filter(meal => status.get(meal.id) === 'SKIPPED');
  const unregistered = meals.length - consumed.length - skipped.length;
  const summarize = (nutrient: Nutrient) => {
    const planned = sumNutrient(meals, nutrient);
    const reportedPlan = sumNutrient(consumed, nutrient);
    const extras = extraMeals === null ? null : sumNutrient(extraMeals, nutrient);
    const actual = extras === null ? null : {
      known: reportedPlan.known + extras.known,
      missing: reportedPlan.missing + extras.missing,
      count: reportedPlan.count + extras.count,
    };
    const canCompare = planned.count > 0 && planned.missing === 0 && unregistered === 0 &&
      actual !== null && actual.missing === 0;
    const difference = canCompare ? actual.known - planned.known : null;
    return { planned, reportedPlan, extras, actual, difference };
  };
  const nutrients = {
    kcal: summarize('kcal'), protein: summarize('protein'), carbs: summarize('carbs'),
    fat: summarize('fat'), fiber: summarize('fiber'),
  };
  return { ...nutrients.kcal, nutrients, unregistered, skipped: skipped.length };
}
