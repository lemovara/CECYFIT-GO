/** Nutrient values are per 100 g; null means unavailable, never zero. */
export const nutrientNames = ["energy", "protein", "carbohydrates", "fat", "fiber", "sodium"] as const;
export type Nutrient = typeof nutrientNames[number];
export type Composition = Partial<Record<Nutrient, number | null>>;
export type Ingredient = { id: string; grams: number; nutrients: Composition };
export type NutrientTotal = { known: number; complete: boolean; missing: string[] };

function validNonNegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }

export function calculateNutrition(ingredients: Ingredient[], servings: number): Record<Nutrient, NutrientTotal> {
  if (!Number.isFinite(servings) || servings <= 0) throw new Error("Las porciones deben ser mayores que cero.");
  for (const item of ingredients) {
    if (!validNonNegative(item.grams)) throw new Error("El gramaje debe ser un número no negativo.");
    for (const value of Object.values(item.nutrients)) {
      if (value != null && !validNonNegative(value)) throw new Error("El valor nutricional debe ser un número no negativo.");
    }
  }
  return Object.fromEntries(nutrientNames.map(name => {
    let known = 0; const missing: string[] = [];
    for (const item of ingredients) {
      if (item.grams === 0) continue;
      const value = item.nutrients[name];
      if (value == null) missing.push(item.id);
      else known += item.grams * value / 100 / servings;
    }
    return [name, { known, complete: missing.length === 0 && ingredients.some(item => item.grams > 0), missing }];
  })) as Record<Nutrient, NutrientTotal>;
}

export type AdjustableIngredient = Ingredient & { min: number; max: number; step: number; locked: boolean };
export type MacroTargets = Partial<Record<"protein" | "carbohydrates" | "fat", number>>;

/** Deterministic projected coordinate descent. Proposals require professional review. */
export function optimizeRecipe(items: AdjustableIngredient[], targets: MacroTargets) {
  const macros = (["protein", "carbohydrates", "fat"] as const).filter(m => targets[m] != null);
  if (!macros.length || !items.length) throw new Error("Selecciona ingredientes y al menos una meta.");
  for (const macro of macros) if (!validNonNegative(targets[macro]!)) throw new Error("Meta inválida.");
  for (const item of items) {
    if (![item.grams, item.min, item.max, item.step].every(validNonNegative) || item.step === 0 || item.min > item.max || item.grams < item.min || item.grams > item.max) throw new Error("Límites de ingrediente inválidos.");
    if (macros.some(macro => item.nutrients[macro] == null || !validNonNegative(item.nutrients[macro]!))) throw new Error("Falta composición nutrimental para optimizar.");
  }
  const quantities = items.map(item => item.grams);
  const score = (q: number[]) => {
    let error = 0;
    for (const macro of macros) {
      const actual = items.reduce((sum, item, i) => sum + q[i] * item.nutrients[macro]! / 100, 0);
      error += ((actual - targets[macro]!) / Math.max(1, targets[macro]!)) ** 2;
    }
    return error + q.reduce((sum, value, i) => sum + 0.01 * ((value - items[i].grams) / Math.max(1, items[i].grams)) ** 2, 0);
  };
  let converged = false;
  for (let pass = 0; pass < 1000; pass++) {
    let improved = false;
    items.forEach((item, i) => {
      if (item.locked) return;
      let best = score(quantities); let bestValue = quantities[i];
      for (const direction of [-1, 1]) {
        const candidate = quantities.slice();
        const proposed = quantities[i] + direction * item.step;
        if (proposed < item.min - 1e-9 || proposed > item.max + 1e-9) continue;
        candidate[i] = Math.min(item.max, Math.max(item.min, proposed));
        const next = score(candidate);
        if (next + 1e-12 < best) { best = next; bestValue = candidate[i]; }
      }
      if (bestValue !== quantities[i]) { quantities[i] = bestValue; improved = true; }
    });
    if (!improved) { converged = true; break; }
  }
  const proposal = items.map((item, i) => ({ ...item, grams: quantities[i] }));
  const totals = calculateNutrition(proposal, 1);
  const unmet = macros.filter(m => Math.abs(totals[m].known - targets[m]!) > Math.max(1, targets[m]! * 0.05));
  return { ingredients: proposal, totals, unmet, converged, notice: !converged ? "El cálculo alcanzó su límite de iteraciones; revisa la propuesta y las restricciones." : unmet.length ? "La propuesta no alcanzó todas las metas; revisa las restricciones." : "Propuesta pendiente de revisión profesional." };
}
