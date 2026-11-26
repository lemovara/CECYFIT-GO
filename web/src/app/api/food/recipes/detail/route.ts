import { createClient } from '@supabase/supabase-js';
import { normalizeRecipe, normalizeRecipeDetail, normalizeSpanishRecipeHtml } from '@/lib/nutrition/myplate';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return Response.json({ error: 'Se requiere una sesión.' }, { status: 401 });
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'Se requiere una sesión válida.' }, { status: 401 });
  const slug = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return Response.json({ error: 'Receta inválida.' }, { status: 400 });
  const quota = await client.rpc('claim_food_search');
  if (quota.error) return Response.json({ error: 'No se pudo comprobar la disponibilidad de búsquedas.' }, { status: 503 });
  if (quota.data !== true) return Response.json({ error: 'Límite temporal de consultas; intenta en un minuto.' }, { status: 429 });
  try {
    const response = await fetch(`https://myplate.food/api/v1/recipes/${slug}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (response.status === 429) return Response.json({ error: 'El proveedor alcanzó su límite de consultas. Inténtalo más tarde.' }, { status: 429 });
    if (!response.ok) throw new Error('Proveedor no disponible');
    const raw = await response.json();
    const fallback = normalizeRecipeDetail(raw);
    const recipe = normalizeRecipe(raw);
    let detail = fallback;
    if (recipe) {
      try {
        const spanish = await fetch(recipe.url, { signal: AbortSignal.timeout(6000), cache: 'no-store', redirect: 'error' });
        if (spanish.ok) detail = normalizeSpanishRecipeHtml(await spanish.text(), recipe.url) ?? fallback;
      } catch { /* Keep the original detail when the translated page is unavailable. */ }
    }
    if (!detail) throw new Error('Detalle incompleto');
    return Response.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'No se pudo consultar el detalle. Puedes abrir la receta original.' }, { status: 502 }); }
}
