/** Scale quantities for one assigned meal. Null means a value requires correction. */
export function portionGrams(grams: number, recipeServings: number, assignedServings: number): number | null {
  if (![grams, recipeServings, assignedServings].every(Number.isFinite) || grams <= 0 || grams > 5000 ||
      !Number.isInteger(recipeServings) || recipeServings < 1 || recipeServings > 100 ||
      assignedServings <= 0 || assignedServings > 100) return null;
  const result = Math.round((grams * assignedServings / recipeServings) * 10) / 10;
  return result >= 0.1 && result <= 5000 ? result : null;
}
