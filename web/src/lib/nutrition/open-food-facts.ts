export type FoodSearchResult = {
  id: string; type: 'product'; name: string; brand: string | null; barcode: string;
  energyKcal: number | null; proteinG: number | null; carbohydratesG: number | null; fatG: number | null;
  photoUrl: string | null;
  allergens: string[]; traces: string[]; labels: string[]; mexico: boolean | null;
  source: 'Open Food Facts'; reference: '100g_or_100ml';
};

const names: Record<string, string> = { 'en:milk': 'Leche', 'en:eggs': 'Huevo', 'en:gluten': 'Gluten',
  'en:soybeans': 'Soya', 'en:peanuts': 'Cacahuate', 'en:nuts': 'Frutos secos', 'en:fish': 'Pescado',
  'en:crustaceans': 'Crustáceos', 'en:molluscs': 'Moluscos', 'en:sesame-seeds': 'Ajonjolí',
  'en:celery': 'Apio', 'en:mustard': 'Mostaza', 'en:sulphur-dioxide-and-sulphites': 'Sulfitos', 'en:lupin': 'Altramuz' };
function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string' && /^[a-z]{2}:[a-z0-9-]{1,100}$/.test(tag))
    .map(tag => names[tag] ?? (tag.startsWith('es:') ? tag.slice(3).replaceAll('-', ' ') : tag)))].slice(0, 20);
}

/** Missing and non-numeric values remain unknown; never infer units or calories. */
export function normalizeProduct(input: unknown): FoodSearchResult | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const barcode = typeof item.code === 'string' ? item.code : '';
  const name = typeof item.product_name_es === 'string' && item.product_name_es.trim() ? item.product_name_es.trim() : typeof item.product_name === 'string' ? item.product_name.trim() : '';
  if (!/^\d{4,24}$/.test(barcode) || !name) return null;
  const nutriments = item.nutriments && typeof item.nutriments === 'object' ? item.nutriments as Record<string, unknown> : {};
  const number = (key: string) => typeof nutriments[key] === 'number' && Number.isFinite(nutriments[key]) && (nutriments[key] as number) >= 0 ? nutriments[key] as number : null;
  const image = typeof item.image_front_small_url === 'string' && /^https:\/\/images\.openfoodfacts\.org\/images\/products\/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$/.test(item.image_front_small_url) ? item.image_front_small_url : null;
  const countries = Array.isArray(item.countries_tags) ? item.countries_tags.filter((value): value is string => typeof value === 'string') : [];
  return { id: `off:${barcode}`, type: 'product', name, barcode, photoUrl: image,
    brand: typeof item.brands === 'string' && item.brands.trim() ? item.brands.trim() : null,
    energyKcal: number('energy-kcal_100g'), proteinG: number('proteins_100g'),
    carbohydratesG: number('carbohydrates_100g'), fatG: number('fat_100g'), allergens: tags(item.allergens_tags),
    traces: tags(item.traces_tags), labels: tags(item.labels_tags), mexico: countries.length ? countries.includes('en:mexico') : null, source: 'Open Food Facts', reference: '100g_or_100ml' };
}

/** Prioritize within each provider page without dropping products from other countries. */
export function prioritizeMexico<T extends { mexico: boolean | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.mexico === true) - Number(a.mexico === true));
}
