import { calculateNutrition } from './engine.ts';

type Food = { id: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
type Row = { id: string; grams: string };

/** Return no estimate until each row is complete and uniquely identified. */
export function previewProfessionalDraft(rows: Row[], foods: Food[]) {
  if (!rows.length || new Set(rows.map(row => row.id)).size !== rows.length) return null;
  const items = [];
  for (const row of rows) {
    const food = foods.find(item => item.id === row.id), grams = Number(row.grams);
    if (!food || !row.grams.trim() || !Number.isFinite(grams) || grams <= 0 || grams > 5000) return null;
    items.push({ id: row.id, grams, nutrients: { energy:food.kcal,protein:food.protein,carbohydrates:food.carbs,fat:food.fat,fiber:food.fiber } });
  }
  return calculateNutrition(items,1);
}
