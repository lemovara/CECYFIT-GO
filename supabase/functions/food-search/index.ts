import { createFoodSearchHandler } from './handler.ts';

async function claimQuota(request: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('authorization');
  if (!url || !key || !authorization) throw new Error('Configuración incompleta');
  const response = await fetch(`${url}/rest/v1/rpc/claim_food_search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, authorization }, body: '{}', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Cuota no disponible');
  return await response.json() === true;
}

Deno.serve(createFoodSearchHandler(fetch, Date.now, claimQuota));
