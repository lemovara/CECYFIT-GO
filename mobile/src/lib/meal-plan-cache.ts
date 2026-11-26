import type { MealPlanCache } from './meal-plan-cache-core';

// The web client is online-only until it has an encrypted IndexedDB store.
export const mealPlanCache: MealPlanCache = {
  async read() { return null; },
  async write() {},
};
