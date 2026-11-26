import type { NutritionGoalCache } from './nutrition-goal-cache-core';
// Web does not persist health data in an unprotected browser store.
export const nutritionGoalCache: NutritionGoalCache = { async read() { return null; }, async write() {} };
