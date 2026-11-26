import { createClient } from '@supabase/supabase-js';
import { normalizeProduct, prioritizeMexico, type FoodSearchResult } from '@/lib/nutrition/open-food-facts';

const cache = new Map<string, { expires: number; savedAt: number; products: FoodSearchResult[]; hasMore: boolean }>();
const requests: number[] = [];
export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return Response.json({ error: 'Se requiere una sesión.' }, { status: 401 });
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'Se requiere una sesión válida.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const term = (params.get('q') ?? '').trim().replace(/\s+/g, ' ');
  const page = Number(params.get('page') ?? 1);
  if (term.length < 2 || term.length > 80 || !Number.isInteger(page) || page < 1 || page > 50) return Response.json({ error: 'Revisa el texto de búsqueda.' }, { status: 400 });
  const cacheKey = `${term.toLocaleLowerCase('es-MX')}:${page}`;
  const now = Date.now(); const previous = cache.get(cacheKey);
  if (previous && previous.expires > now) return Response.json({ products: previous.products, hasMore: previous.hasMore, stale: false });
  while (requests.length && requests[0] <= now - 60000) requests.shift();
  if (requests.length >= 8) return Response.json({ error: 'Se alcanzó el límite de consultas. Intenta en un minuto.' }, { status: 429 });
  const quota = await client.rpc('claim_food_search');
  if (quota.error) return Response.json({ error: 'No se pudo comprobar la disponibilidad de búsquedas.' }, { status: 503 });
  if (quota.data !== true) return Response.json({ error: 'Se alcanzó el límite de consultas. Intenta en un minuto.' }, { status: 429 });
  requests.push(now);
  try {
    const search = new URLSearchParams({ search_terms: term, search_simple: '1', action: 'process', json: '1', page: String(page), page_size: '20', fields: 'code,product_name,product_name_es,brands,nutriments,image_front_small_url,allergens_tags,traces_tags,labels_tags,countries_tags' });
    const upstream = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${search}`, { headers: { 'User-Agent': 'CECYFIT-GO/1.0 (https://github.com/lemovara/CECYFIT-GO)' }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!upstream.ok) throw new Error('provider error');
    const body = await upstream.json();
    const products = prioritizeMexico<FoodSearchResult>((Array.isArray(body.products) ? body.products : []).map(normalizeProduct).filter((item: FoodSearchResult | null): item is FoodSearchResult => item !== null));
    const hasMore = typeof body.count === 'number' && page * 20 < body.count;
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: now + 15 * 60 * 1000, savedAt: now, products, hasMore });
    return Response.json({ products, hasMore, stale: false });
  } catch {
    if (previous && now - previous.savedAt <= 24 * 60 * 60 * 1000) return Response.json({ products: previous.products, hasMore: previous.hasMore, stale: true, savedAt: new Date(previous.savedAt).toISOString() });
    return Response.json({ error: 'Open Food Facts no está disponible. El catálogo local sigue accesible.' }, { status: 502 });
  }
}
