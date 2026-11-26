// Runs only against disposable, pre-created .invalid accounts. Fixture creation/cleanup is external.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { quoteGroceries } from '../../mobile/src/lib/grocery-quote.ts';
import { MigratingSessionStorage } from '../../mobile/src/lib/session-storage-core.ts';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const requireFromWeb = createRequire(resolve(root, 'web/package.json'));
const { createClient } = requireFromWeb('@supabase/supabase-js');
const config = Object.fromEntries(readFileSync(resolve(root, 'web/.env.local'), 'utf8').split(/\r?\n/)
  .map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(match => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
const emails = ['CECYFIT_SMOKE_PRO', 'CECYFIT_SMOKE_PATIENT', 'CECYFIT_SMOKE_OTHER'].map(key => process.env[key]);
const password = process.env.CECYFIT_SMOKE_PASSWORD;
const patientId = process.env.CECYFIT_SMOKE_PATIENT_ID;
if (process.env.CECYFIT_SMOKE_RUN !== 'YES' || emails.some(email => !/^cecyfit-smoke-[a-f0-9]+@(example\.invalid)$/.test(email ?? '')) ||
  !password || !/^[0-9a-f-]{36}$/.test(patientId ?? '')) throw new Error('Se requieren cuentas de prueba .invalid y una ficha temporal explícitas.');
if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Falta configuración pública de Supabase.');

async function signIn(email, storage) {
  const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: Boolean(storage), autoRefreshToken: false, ...(storage ? { storage } : {}) } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar la sesión de prueba: ${error.message}`);
  return client;
}

function memoryStorage() {
  const values = new Map();
  return { values, async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); }, async removeItem(key) { values.delete(key); } };
}
const legacy = memoryStorage(), protectedStorage = memoryStorage();
const [professional, initialPatient, other] = await Promise.all([signIn(emails[0]), signIn(emails[1], legacy), signIn(emails[2])]);
const initialUser = (await initialPatient.auth.getSession()).data.session?.user.id;
const patient = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: false, storage: new MigratingSessionStorage(protectedStorage, legacy) } });
const restored = await patient.auth.getSession();
assert.equal(restored.error, null);
assert.equal(restored.data.session?.user.id, initialUser);
assert.ok(protectedStorage.values.size > 0);
assert.equal(legacy.values.size, 0);
const synonymSearch = await patient.from('food_ingredients').select('id,name')
  .or('name.ilike.%jitomate%,name.ilike.%tomate rojo%').limit(30);
if (synonymSearch.error) throw new Error(`No se pudo consultar el buscador local: ${synonymSearch.error.message}`);
assert.ok(synonymSearch.data.some(row => row.name.toLowerCase().includes('jitomate')));
const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const part = key => dayParts.find(value => value.type === key)?.value;
const day = `${part('year')}-${part('month')}-${part('day')}`;
const assigned = await professional.rpc('create_and_assign_professional_recipe', {
  p_patient_id: patientId, p_day: day, p_time: '07:12', p_title: 'Prueba temporal', p_description: 'Prueba temporal',
  p_quantities: { avena: 50, platano: 100 },
});
if (assigned.error) throw new Error(`No se pudo asignar: ${assigned.error.message}`);
const mealId = assigned.data;
const photoUrl = 'https://recipe-images.myplate.food/recipe-images/2-step-chicken.jpg';
const photoMeal = await professional.rpc('create_and_assign_external_recipe', {
  p_patient_id: patientId, p_day: day, p_time: '07:13', p_title: 'Prueba temporal con imagen', p_description: 'Prueba temporal',
  p_quantities: { avena: 50, platano: 100 }, p_photo_url: photoUrl,
});
if (photoMeal.error) throw new Error(`No se pudo asignar con imagen: ${photoMeal.error.message}`);
const photoRead = await patient.from('patient_meals').select('photo_url,nutrition_snapshot').eq('id', photoMeal.data).single();
if (photoRead.error) throw new Error(`El paciente no pudo consultar la imagen: ${photoRead.error.message}`);
assert.equal(photoRead.data.photo_url, photoUrl);
assert.equal(photoRead.data.nutrition_snapshot.kcal, 278.5);
const originalVersion = photoRead.data.nutrition_snapshot.id;
const ownRecipe = await professional.from('professional_recipe_versions')
  .select('id,professional_recipe_photos(photo_url)').eq('id', originalVersion).single();
if (ownRecipe.error) throw new Error(`No se pudo consultar la receta privada: ${ownRecipe.error.message}`);
assert.equal(ownRecipe.data.professional_recipe_photos?.photo_url, photoUrl);
const patientPhotos = await patient.from('professional_recipe_photos').select('version_id').eq('version_id', originalVersion);
if (patientPhotos.error) throw new Error(`Falló el aislamiento de fotos: ${patientPhotos.error.message}`);
assert.equal(patientPhotos.data.length, 0);
const revised = await professional.rpc('save_professional_recipe_with_photo', {
  p_title: 'Versión temporal', p_description: '', p_quantities: { avena: 80 }, p_parent_version: originalVersion, p_photo_url: photoUrl,
});
if (revised.error) throw new Error(`No se pudo versionar con imagen: ${revised.error.message}`);
const reassigned = await professional.rpc('assign_professional_recipe', {
  p_patient_id: patientId, p_day: day, p_time: '07:14', p_version_id: revised.data,
});
if (reassigned.error) throw new Error(`No se pudo reasignar con imagen: ${reassigned.error.message}`);
const reassignedRead = await patient.from('patient_meals').select('photo_url').eq('id', reassigned.data).single();
if (reassignedRead.error) throw new Error(`No se pudo consultar la reasignación: ${reassignedRead.error.message}`);
assert.equal(reassignedRead.data.photo_url, photoUrl);
const product = await professional.rpc('assign_branded_product', {
  p_patient_id: patientId, p_day: day, p_time: '07:15', p_name: 'Producto temporal', p_brand: 'Prueba',
  p_code: '12345678', p_amount: 150, p_unit: 'g', p_energy: 200, p_protein: 10, p_carbs: null, p_fat: 5, p_photo_url: null,
});
if (product.error) throw new Error(`No se pudo asignar el producto: ${product.error.message}`);
const productRead = await patient.from('patient_meals').select('nutrition_snapshot,kcal').eq('id', product.data).single();
if (productRead.error) throw new Error(`El paciente no pudo leer el producto: ${productRead.error.message}`);
assert.equal(productRead.data.kcal, 300);
assert.equal(productRead.data.nutrition_snapshot.protein, 15);
assert.equal(productRead.data.nutrition_snapshot.carbs, null);
const productPrice = await patient.rpc('save_market_product_price', { p_store: 'Walmart', p_branch: 'prueba temporal', p_product_id: 'off:12345678', p_unit: 'g', p_amount: 100, p_price: 20 });
if (productPrice.error) throw new Error(`No se pudo guardar el precio del producto: ${productPrice.error.message}`);
const productPrices = await patient.from('market_product_prices').select('product_id,unit,pack_amount,pack_price,observed_on').eq('store', 'Walmart').eq('branch', 'prueba temporal');
if (productPrices.error) throw new Error(`No se pudo leer el precio del producto: ${productPrices.error.message}`);
const productQuote = quoteGroceries([{ id: product.data, name: 'Producto temporal', recipe: productRead.data.nutrition_snapshot }], [], productPrices.data);
assert.equal(productQuote.purchase, 4000);
assert.equal(productQuote.consumed, 3000);
assert.equal(productQuote.complete, true);
const otherPrices = await other.from('market_product_prices').select('product_id').eq('product_id', 'off:12345678');
if (otherPrices.error) throw new Error(`No se pudo comprobar el aislamiento de precios: ${otherPrices.error.message}`);
assert.equal(otherPrices.data.length, 0);
const read = await patient.from('patient_meals').select('id,patient_id,nutrition_snapshot').eq('id', mealId).single();
if (read.error) throw new Error(`El paciente no pudo consultar: ${read.error.message}`);
assert.equal(read.data.nutrition_snapshot.kcal, 278.5);
const quote = quoteGroceries([{ id: mealId, recipe: read.data.nutrition_snapshot }], []);
assert.equal(quote.items.find(item => item.ingredient.id === 'avena')?.ingredient.grams, 50);
assert.equal(quote.items.find(item => item.ingredient.id === 'platano')?.ingredient.grams, 100);
assert.equal(quote.complete, false);
const logged = await patient.rpc('record_meal_status', { target_meal_id: mealId, meal_status: 'CONSUMED' });
if (logged.error) throw new Error(`No se pudo registrar comida del plan: ${logged.error.message}`);
const tracking = await professional.from('meal_logs').select('status').eq('meal_id', mealId).single();
if (tracking.error) throw new Error(`El profesional no pudo consultar el seguimiento: ${tracking.error.message}`);
assert.equal(tracking.data.status, 'CONSUMED');
const denied = await other.from('patient_meals').select('id').eq('id', mealId);
if (denied.error) throw new Error(`Falló consulta de aislamiento: ${denied.error.message}`);
assert.equal(denied.data.length, 0);
const messageId = randomUUID();
const sendMessage = () => patient.rpc('send_patient_message', { p_id: messageId, p_patient_id: patientId, p_body: 'Mensaje temporal' });
const firstMessage = await sendMessage(), messageRetry = await sendMessage();
if (firstMessage.error || messageRetry.error) throw new Error('No se pudo verificar el envío o su reintento.');
const observedMessage = await professional.from('patient_messages').select('id,body').eq('id', messageId);
if (observedMessage.error) throw new Error(`El profesional no pudo consultar el mensaje: ${observedMessage.error.message}`);
assert.equal(observedMessage.data.length, 1);
assert.equal(observedMessage.data[0].body, 'Mensaje temporal');
const hiddenMessage = await other.from('patient_messages').select('id').eq('id', messageId);
if (hiddenMessage.error) throw new Error(`No se pudo comprobar el aislamiento del chat: ${hiddenMessage.error.message}`);
assert.equal(hiddenMessage.data.length, 0);
const extraId = randomUUID();
const extra = await patient.rpc('record_extra_food', { p_request_id: extraId, p_patient_id: patientId, p_meal_date: day,
  p_name: 'Prueba temporal', p_portion: '50 g', p_kcal: 190,
  p_nutrition_snapshot: { version: 1, kind: 'food', food_id: 'avena', grams: 50, kcal: 189.5, protein: 6.58 } });
if (extra.error) throw new Error(`No se pudo registrar alimento: ${extra.error.message}`);
const retry = await patient.rpc('record_extra_food', { p_request_id: extraId, p_patient_id: patientId, p_meal_date: day,
  p_name: 'Prueba temporal', p_portion: '50 g', p_kcal: 190,
  p_nutrition_snapshot: { version: 1, kind: 'food', food_id: 'avena', grams: 50, kcal: 189.5, protein: 6.58 } });
if (retry.error) throw new Error(`Falló el reintento de alimento: ${retry.error.message}`);
const observed = await professional.from('extra_meal_logs').select('id,nutrition_snapshot').eq('id', extraId).single();
if (observed.error) throw new Error(`El profesional no pudo consultar: ${observed.error.message}`);
assert.equal(observed.data.nutrition_snapshot.protein, 6.58);
let externalResults = null;
if (process.env.CECYFIT_SMOKE_SKIP_EXTERNAL !== 'YES') {
  const external = await patient.functions.invoke('food-search', { body: { query: 'avena', page: 1 } });
  if (external.error) throw new Error(`La búsqueda externa autenticada falló: ${external.error.message}`);
  assert.ok(Array.isArray(external.data.products));
  externalResults = external.data.products.length;
}
let recipeSearch = 'not_tested';
if (process.env.CECYFIT_SMOKE_WEB_URL) {
  const base = process.env.CECYFIT_SMOKE_WEB_URL;
  if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(base)) throw new Error('La prueba web solo permite localhost.');
  const { data: auth } = await professional.auth.getSession();
  const response = await fetch(`${base}/api/food/recipes?q=pollo&page=1`, { headers: { Authorization: `Bearer ${auth.session.access_token}` } });
  if (!response.ok) throw new Error(`La búsqueda web respondió HTTP ${response.status}`);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.recipes) && payload.recipes.length > 0);
  const browse = await fetch(`${base}/api/food/recipes?page=1`, { headers: { Authorization: `Bearer ${auth.session.access_token}` } });
  if (!browse.ok) throw new Error(`La exploración web respondió HTTP ${browse.status}`);
  const browsed = await browse.json();
  assert.ok(Array.isArray(browsed.recipes) && browsed.recipes.length > 0 && browsed.total >= 100);
  assert.ok(browsed.recipes.some(recipe => recipe.photo));
  const detailResponse = await fetch(`${base}/api/food/recipes/detail?id=2-step-chicken`, { headers: { Authorization: `Bearer ${auth.session.access_token}` } });
  if (!detailResponse.ok) throw new Error(`El detalle web respondió HTTP ${detailResponse.status}`);
  const detail = await detailResponse.json();
  assert.ok(Array.isArray(detail.ingredients) && detail.ingredients.length > 0 && typeof detail.directions === 'string');
  recipeSearch = 'ok';
}
const signOut = await patient.auth.signOut({ scope: 'local' });
if (signOut.error) throw new Error(`No se pudo cerrar la sesión temporal: ${signOut.error.message}`);
assert.equal(protectedStorage.values.size, 0);
assert.equal(legacy.values.size, 0);
console.log(JSON.stringify({ sessions: 3, session_migration: true, sign_out: true, assignment: true, patient_read: true, grocery: true, isolation: true,
  planned_intake: true, extra_intake: true, idempotent_retry: true, professional_read: true, external_search: externalResults !== null,
  external_results: externalResults, recipe_search: recipeSearch, recipe_photo: true }));
