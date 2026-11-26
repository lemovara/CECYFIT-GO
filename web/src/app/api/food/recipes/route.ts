import { createClient } from '@supabase/supabase-js';
import { normalizeRecipe, searchTerm, type ExternalRecipe } from '@/lib/nutrition/myplate';

// This provider permits live requests, not bulk mirroring. Do not persist search results.
const requests: number[] = [];
export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return Response.json({ error: 'Se requiere una sesión.' }, { status: 401 });
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'Se requiere una sesión válida.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') ?? '').trim();
  const page = Number(params.get('page') ?? '1');
  if ((query.length > 0 && query.length < 2) || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 100) return Response.json({ error: 'Revisa la búsqueda.' }, { status: 400 });
  const now = Date.now();
  while (requests.length && requests[0] <= now - 60000) requests.shift();
  if (requests.length >= 12) return Response.json({ error: 'Límite temporal de consultas; intenta de nuevo en un minuto.' }, { status: 429 });
  const quota = await client.rpc('claim_food_search');
  if (quota.error) return Response.json({ error: 'No se pudo comprobar la disponibilidad de búsquedas.' }, { status: 503 });
  if (quota.data !== true) return Response.json({ error: 'Límite temporal de consultas; intenta de nuevo en un minuto.' }, { status: 429 });
  requests.push(now);
  try {
    const searched = query ? searchTerm(query) : '';
    const search = new URLSearchParams({ limit: '12', offset: String((page - 1) * 12) });
    if (searched) search.set('q', searched);
    const response = await fetch(`https://myplate.food/api/v1/recipes?${search}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('provider unavailable');
    const body = await response.json();
    const recipes = (Array.isArray(body.results) ? body.results : []).map(normalizeRecipe).filter((recipe: ExternalRecipe | null): recipe is ExternalRecipe => recipe !== null);
    return Response.json({ recipes, searched, total: typeof body.total === 'number' ? body.total : null, hasMore: typeof body.total === 'number' && page * 12 < body.total && page < 100 });
  } catch { return Response.json({ error: 'No se pudo consultar MyPlate.food. El catálogo local sigue disponible.' }, { status: 502 }); }
}
