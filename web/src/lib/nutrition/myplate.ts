export type ExternalRecipe = { id: string; title: string; originalTitle: string; url: string; photo: string | null };
export type ExternalRecipeDetail = { ingredients: { text: string; note: string | null }[]; directions: string; servings: string | null; language: 'es' | 'en' };

export function normalizeRecipeDetail(input: unknown): ExternalRecipeDetail | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  if (!Array.isArray(row.ingredients) || typeof row.directions !== 'string' || !row.directions.trim()) return null;
  const ingredients = row.ingredients.slice(0, 40).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.text !== 'string' || !item.text.trim()) return [];
    return [{ text: item.text.trim().slice(0, 300), note: typeof item.note === 'string' ? item.note.trim().slice(0, 300) || null : null }];
  });
  if (!ingredients.length) return null;
  return { ingredients, directions: row.directions.trim().slice(0, 6000), servings: typeof row.yield === 'string' ? row.yield.slice(0, 100) : null, language: 'en' };
}

export function normalizeSpanishRecipeHtml(html: string, expectedUrl: string): ExternalRecipeDetail | null {
  if (html.length > 2_000_000) return null;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1])) continue;
    try {
      const row = JSON.parse(match[2]) as Record<string, unknown>;
      if (row['@type'] !== 'Recipe' || row.url !== expectedUrl || typeof row.inLanguage !== 'string' || !/^es(?:-|$)/i.test(row.inLanguage)) continue;
      if (!Array.isArray(row.recipeIngredient) || !Array.isArray(row.recipeInstructions)) continue;
      const ingredients = row.recipeIngredient.slice(0, 40).flatMap(value =>
        typeof value === 'string' && value.trim() ? [{ text: value.trim().slice(0, 300), note: null }] : []);
      const directions = row.recipeInstructions.slice(0, 50).flatMap(value => {
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        if (value && typeof value === 'object' && typeof value.text === 'string' && value.text.trim()) return [value.text.trim()];
        return [];
      }).join('\n');
      if (!ingredients.length || !directions || directions.length > 6000) continue;
      return { ingredients, directions, servings: typeof row.recipeYield === 'string' ? row.recipeYield.slice(0, 100) : null, language: 'es' };
    } catch { /* Ignore invalid structured data. */ }
  }
  return null;
}

const translations: Record<string, string> = {
  pollo: 'chicken', pescado: 'fish', atun: 'tuna', huevo: 'egg', huevos: 'eggs',
  frijol: 'bean', frijoles: 'beans', arroz: 'rice', avena: 'oat', manzana: 'apple',
  platano: 'banana', aguacate: 'avocado', queso: 'cheese', verduras: 'vegetables',
  zanahoria: 'carrot', tomate: 'tomato', jitomate: 'tomato', sopa: 'soup', ensalada: 'salad',
  carne: 'beef', res: 'beef', cerdo: 'pork', pavo: 'turkey', camaron: 'shrimp',
  lenteja: 'lentil', lentejas: 'lentils', garbanzo: 'chickpea', garbanzos: 'chickpeas',
  calabacita: 'zucchini', calabaza: 'squash', papa: 'potato', papas: 'potatoes',
  camote: 'sweet potato', brocoli: 'broccoli', espinaca: 'spinach', elote: 'corn', maiz: 'corn',
  tortilla: 'tortilla', tortillas: 'tortillas', pasta: 'pasta', pan: 'bread',
  leche: 'milk', yogur: 'yogurt', yogurt: 'yogurt', fruta: 'fruit', frutas: 'fruit',
  naranja: 'orange', fresa: 'strawberry', fresas: 'strawberries', pera: 'pear',
  desayuno: 'breakfast', cena: 'dinner', postre: 'dessert', postres: 'dessert',
};

export function searchTerm(input: string): string {
  const result = input.trim().replace(/\s+/g, ' ').split(' ').map(word => {
    const key = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (['con', 'de', 'del', 'la', 'el', 'y'].includes(key)) return '';
    return translations[key] ?? word;
  }).filter(Boolean).join(' ');
  return result || input.trim();
}

export function normalizeRecipe(input: unknown): ExternalRecipe | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  if (typeof row.slug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(row.slug) || typeof row.name !== 'string' || !row.name.trim()) return null;
  const locales = row.locales && typeof row.locales === 'object' ? row.locales as Record<string, unknown> : {};
  const candidate = typeof locales.es === 'string' ? locales.es : '';
  let url: URL;
  try { url = new URL(candidate); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'myplate.food' || url.port || url.username || url.password || url.search || url.hash || !/^\/es\/recipes\/[a-z0-9%-]+$/i.test(url.pathname)) return null;
  const slug = url.pathname.split('/').pop() ?? '';
  let title: string;
  try { title = decodeURIComponent(slug).replace(/-/g, ' ').trim(); } catch { return null; }
  if (!title) return null;
  let photo: string | null = null;
  try {
    const image = new URL(typeof row.image_url === 'string' ? row.image_url : '');
    if (image.protocol === 'https:' && image.hostname === 'recipe-images.myplate.food' && !image.port && !image.username && !image.password && !image.search && !image.hash && /^\/recipe-images\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(image.pathname)) photo = image.toString();
  } catch { /* Photo is optional. */ }
  return { id: row.slug, title: title.charAt(0).toUpperCase() + title.slice(1), originalTitle: row.name.trim(), url: url.toString(), photo };
}
