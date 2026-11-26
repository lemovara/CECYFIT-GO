export class NutritionGoalNetworkError extends Error {}

export type NutritionGoal = { effective_on: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
export type CachedNutritionGoal = { version: 1; savedAt: string; goal: NutritionGoal | null };
export interface NutritionGoalCache {
  read(userId: string, patientId: string, day: string): Promise<CachedNutritionGoal | null>;
  write(userId: string, patientId: string, day: string, value: CachedNutritionGoal): Promise<void>;
}
const latest = new Map<string, symbol>();
export async function loadNutritionGoal(cache: NutritionGoalCache, userId: string, patientId: string, day: string, fetchGoal: () => Promise<NutritionGoal | null>) {
  const scope = JSON.stringify([userId,patientId,day]), request = Symbol(scope);
  latest.set(scope,request);
  try {
    const value: CachedNutritionGoal = { version:1,savedAt:new Date().toISOString(),goal:await fetchGoal() };
    if (latest.get(scope) === request) { try { await cache.write(userId,patientId,day,value); } catch { /* Online result is still usable. */ } }
    return { ...value,offline:false };
  } catch (error) {
    if (!(error instanceof NutritionGoalNetworkError)) throw error;
    const saved = await cache.read(userId,patientId,day);
    if (!saved) throw error;
    return { ...saved,offline:true };
  } finally { if (latest.get(scope) === request) latest.delete(scope); }
}
