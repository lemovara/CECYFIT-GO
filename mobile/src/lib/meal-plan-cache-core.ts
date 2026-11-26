import type { Meal } from './patient-meals';

export type CachedMealPlan = { version: 1; savedAt: string; meals: Meal[] };
export interface MealPlanCache {
  read(userId: string, patientId: string, week: string): Promise<CachedMealPlan | null>;
  write(userId: string, patientId: string, week: string, plan: CachedMealPlan): Promise<void>;
}

// A server authorization or schema error must never be treated as an offline error.
export class MealNetworkError extends Error {}

/** Only a network failure permits displaying the previously loaded meal. */
export async function loadMealDetail(fetchMeal: () => Promise<Meal | undefined>, fallback?: Meal) {
  try { return { meal: await fetchMeal(), offline: false }; }
  catch (error) {
    if (error instanceof MealNetworkError && fallback) return { meal: fallback, offline: true };
    throw error;
  }
}
const latestRequests = new Map<string, symbol>();

export async function loadMealPlan(
  cache: MealPlanCache, userId: string, patientId: string, week: string,
  fetchPlan: () => Promise<Meal[]>,
) {
  const scope = JSON.stringify([userId, patientId, week]);
  const request = Symbol(scope);
  latestRequests.set(scope, request);
  try {
    const meals = await fetchPlan();
    const plan: CachedMealPlan = { version: 1, savedAt: new Date().toISOString(), meals };
    if (latestRequests.get(scope) === request) {
      try { await cache.write(userId, patientId, week, plan); } catch { /* Online access still works if local storage is unavailable. */ }
    }
    return { ...plan, offline: false };
  } catch (error) {
    if (!(error instanceof MealNetworkError)) throw error;
    const cached = await cache.read(userId, patientId, week);
    if (!cached) throw error;
    return { ...cached, offline: true };
  } finally { if (latestRequests.get(scope) === request) latestRequests.delete(scope); }
}
