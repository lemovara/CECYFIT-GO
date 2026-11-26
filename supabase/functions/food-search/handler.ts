type Product = { id: string; name: string; brand: string | null; photo_url: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  allergens: string[]; traces: string[]; labels: string[]; mexico: boolean | null };
const names: Record<string, string> = { 'en:milk': 'Leche', 'en:eggs': 'Huevo', 'en:gluten': 'Gluten',
  'en:soybeans': 'Soya', 'en:peanuts': 'Cacahuate', 'en:nuts': 'Frutos secos', 'en:fish': 'Pescado',
  'en:crustaceans': 'Crustáceos', 'en:molluscs': 'Moluscos', 'en:sesame-seeds': 'Ajonjolí',
  'en:celery': 'Apio', 'en:mustard': 'Mostaza', 'en:sulphur-dioxide-and-sulphites': 'Sulfitos', 'en:lupin': 'Altramuz' };
function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string' && /^[a-z]{2}:[a-z0-9-]{1,100}$/.test(tag))
    .map(tag => names[tag] ?? (tag.startsWith('es:') ? tag.slice(3).replaceAll('-', ' ') : tag)))].slice(0, 20);
}
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export function normalizeProduct(input: unknown): Product | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.code === 'string' ? item.code : '';
  const name = typeof item.product_name_es === 'string' && item.product_name_es.trim() ? item.product_name_es.trim()
    : typeof item.product_name === 'string' ? item.product_name.trim() : '';
  if (!/^\d{4,24}$/.test(id) || !name) return null;
  const values = item.nutriments && typeof item.nutriments === 'object' ? item.nutriments as Record<string, unknown> : {};
  const number = (key: string) => typeof values[key] === 'number' && Number.isFinite(values[key]) && (values[key] as number) >= 0 ? values[key] as number : null;
  const image = typeof item.image_front_small_url === 'string' && /^https:\/\/images\.openfoodfacts\.org\//.test(item.image_front_small_url) ? item.image_front_small_url : null;
  const countries = Array.isArray(item.countries_tags) ? item.countries_tags.filter((value): value is string => typeof value === 'string') : [];
  return { id: `off:${id}`, name, brand: typeof item.brands === 'string' && item.brands.trim() ? item.brands.trim() : null,
    photo_url: image, kcal: number('energy-kcal_100g'), protein: number('proteins_100g'),
    carbs: number('carbohydrates_100g'), fat: number('fat_100g'), fiber: number('fiber_100g'),
    allergens: tags(item.allergens_tags), traces: tags(item.traces_tags), labels: tags(item.labels_tags),
    mexico: countries.length ? countries.includes('en:mexico') : null };
}

export function createFoodSearchHandler(fetcher: typeof fetch = fetch, now: () => number = Date.now,
  claimQuota: (request: Request) => Promise<boolean> = async () => true) {
  const cache = new Map<string, { expires: number; savedAt: number; products: Product[]; hasMore: boolean }>();
  const requests: number[] = [];
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return json({ error: 'Consulta inválida.' }, 400); }
    const term = typeof body?.query === 'string' ? body.query.trim().replace(/\s+/g, ' ') : '';
    const page = body?.page ?? 1;
    if (term.length < 2 || term.length > 80 || typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 50)
      return json({ error: 'Revisa el texto de búsqueda.' }, 400);
    const key = `${term.toLocaleLowerCase('es-MX')}:${page}`;
    const time = now(), previous = cache.get(key);
    if (previous && previous.expires > time) return json({ products: previous.products, hasMore: previous.hasMore, stale: false });
    while (requests.length && requests[0] <= time - 60000) requests.shift();
    if (requests.length >= 8) return json({ error: 'Límite temporal de búsquedas. Intenta en un minuto.' }, 429);
    try {
      if (!await claimQuota(request)) return json({ error: 'Límite temporal de búsquedas. Intenta en un minuto.' }, 429);
    } catch { return json({ error: 'No se pudo comprobar la disponibilidad de búsquedas.' }, 503); }
    requests.push(time);
    try {
      const params = new URLSearchParams({ search_terms: term, search_simple: '1', action: 'process', json: '1', page: String(page), page_size: '20',
        fields: 'code,product_name,product_name_es,brands,nutriments,image_front_small_url,allergens_tags,traces_tags,labels_tags,countries_tags' });
      const upstream = await fetcher(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
        headers: { 'User-Agent': 'CECYFIT-GO/1.0 (https://github.com/lemovara/CECYFIT-GO)' }, signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) throw new Error('provider');
      const data = await upstream.json();
      const products = (Array.isArray(data.products) ? data.products : []).map(normalizeProduct).filter((product: Product | null): product is Product => product !== null)
        .sort((a: Product, b: Product) => Number(b.mexico === true) - Number(a.mexico === true));
      const hasMore = typeof data.count === 'number' && page * 20 < data.count;
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: time + 15 * 60 * 1000, savedAt: time, products, hasMore });
      return json({ products, hasMore, stale: false });
    } catch {
      if (previous && time - previous.savedAt <= 24 * 60 * 60 * 1000) {
        return json({ products: previous.products, hasMore: previous.hasMore, stale: true, savedAt: new Date(previous.savedAt).toISOString() });
      }
      return json({ error: 'Open Food Facts no está disponible. El catálogo local sigue accesible.' }, 502);
    }
  };
}
