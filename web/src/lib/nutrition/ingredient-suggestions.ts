import { normalizeFoodText } from './local-search.ts';

type Food = { id: string; name: string; original_name?: string | null };
const ignored = new Set(['para', 'sobre', 'hasta', 'entre', 'grande', 'grandes', 'pequeno', 'pequena', 'pequenos', 'pequenas', 'opcional', 'cantidad', 'taza', 'tazas', 'cucharada', 'cucharadas', 'cucharadita', 'cucharaditas', 'gramos', 'gramo', 'litro', 'litros', 'lata', 'latas', 'fresco', 'fresca', 'picado', 'picada', 'rebanadas', 'rebanada']);

function tokens(text: string): string[] {
  return normalizeFoodText(text).split(/[^\p{L}]+/u).filter(word => word.length >= 4 && !ignored.has(word));
}

/** Suggestions require human confirmation; they never infer amounts or food equivalence. */
export function suggestIngredients<T extends Food>(source: string, foods: T[], limit = 4): T[] {
  const sourceWords = new Set(tokens(source));
  if (!sourceWords.size) return [];
  return foods.map(food => {
    const words = new Set(tokens(`${food.name} ${food.original_name ?? ''}`));
    const common = [...words].filter(word => sourceWords.has(word));
    return { food, score: common.reduce((sum, word) => sum + word.length, 0) };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'es-MX'))
    .slice(0, Math.max(0, limit)).map(item => item.food);
}
