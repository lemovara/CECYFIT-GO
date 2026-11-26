"use client";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/clients";
import { calculateNutrition } from "@/lib/nutrition/engine";
import { searchLocalFoods } from "@/lib/nutrition/local-search";
import type { FoodSearchResult } from "@/lib/nutrition/open-food-facts";
import { ProfessionalRecipes } from "./ProfessionalRecipes";
import { ExternalRecipeSearch } from "./ExternalRecipeSearch";
import { RecipeOptimizer } from "./RecipeOptimizer";

type Recipe = {
  id: string; title: string; description: string; photo_url: string | null;
  kcal: number; protein: number; carbs: number; fat: number; fiber: number;
  ingredients: { id: string; name: string; grams: number; photo_url: string | null }[];
};
type CatalogIngredient = { id: string; name: string; photo_url: string | null; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; source_name: string | null; source_url: string | null; original_name: string | null; energy_nutrient_id: number | null };

export function CatalogMealPicker({ patientId, date, onAssigned }: {
  patientId: string; date: string; onAssigned: () => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>();
  const [composition, setComposition] = useState<CatalogIngredient[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recipeRefresh, setRecipeRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'food' | 'recipe'>('all');
  const [page, setPage] = useState(0);
  const [selectedFood, setSelectedFood] = useState<CatalogIngredient | null>(null);
  const [external, setExternal] = useState<{ query: string; page: number; products: FoodSearchResult[]; hasMore: boolean; stale?: boolean; savedAt?: string }>();
  const [externalError, setExternalError] = useState("");
  const [externalBusy, setExternalBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodSearchResult | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    async function pages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
      const rows: T[] = [];
      for (let page = 0; page < 20; page++) {
        const result = await query(page * 500, page * 500 + 499);
        if (result.error) throw result.error;
        const batch = result.data ?? [];
        rows.push(...batch);
        if (batch.length < 500) return rows;
      }
      throw new Error('El catálogo supera el límite de carga.');
    }
    void Promise.all([
      pages((from, to) => supabase.from("recipe_catalog").select("*").order("title").order("id").range(from, to)),
      pages((from, to) => supabase.from("food_ingredients").select("id,name,photo_url,kcal,protein,carbs,fat,fiber,source_name,source_url,original_name,energy_nutrient_id").order("id").range(from, to)),
    ]).then(([data, ingredients]) => {
      if (active) { setFailed(false); setRecipes(data as Recipe[]); setComposition(ingredients as CatalogIngredient[]); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  const results = recipes && searchLocalFoods([
    ...recipes.map(recipe => ({ type: 'recipe' as const, id: recipe.id, name: recipe.title, terms: [recipe.description, ...recipe.ingredients.map(item => item.name)] })),
    ...composition.map(food => ({ type: 'food' as const, id: food.id, name: food.name, terms: food.original_name ? [food.original_name] : [] })),
  ], query, filter);
  const pageSize = 12;
  async function searchProducts(term: string, requestedPage: number) {
    if (externalBusy || term.trim().length < 2) return;
    setExternalBusy(true); setExternalError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Inicia sesión para consultar productos.');
      const response = await fetch(`/api/food/search?q=${encodeURIComponent(term.trim())}&page=${requestedPage}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron consultar los productos.');
      setExternal({ query: term, page: requestedPage, products: result.products, hasMore: result.hasMore, stale: result.stale === true, savedAt: result.savedAt });
    } catch (error) { setExternalError(error instanceof Error ? error.message : 'No se pudieron consultar los productos.'); }
    finally { setExternalBusy(false); }
  }
  const calculated = selected && calculateNutrition(selected.ingredients.map(ingredient => {
    const food = composition.find(value => value.id === ingredient.id);
    return { id: ingredient.id, grams: draft[ingredient.id] ?? ingredient.grams, nutrients: {
      energy: food?.kcal, protein: food?.protein, carbohydrates: food?.carbs, fat: food?.fat, fiber: food?.fiber,
    } };
  }), 1);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const time = String(new FormData(event.currentTarget).get("time") ?? "");
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase.rpc("assign_personalized_recipe", {
        p_patient_id: patientId, p_day: date, p_time: time, p_recipe_id: selected.id,
        p_quantities: Object.fromEntries(selected.ingredients.map(item => [item.id, draft[item.id] ?? item.grams])),
      });
      if (error) {
        setStatus(error.code === "23505" ? "Ya hay una comida en ese horario." : "No se pudo asignar la receta. Revisa el horario y el estado de la ficha.");
      } else {
        setStatus("Receta publicada en la dieta.");
        onAssigned();
      }
    } catch {
      setStatus("No se pudo conectar. Comprueba el menú y vuelve a intentar.");
    } finally {
      setSaving(false);
    }
  }

  async function assignProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct || saving) return;
    const form = new FormData(event.currentTarget);
    const grams = Number(form.get('grams'));
    const unit = String(form.get('unit'));
    const kcal = selectedProduct.energyKcal === null ? null : Math.round(selectedProduct.energyKcal * grams / 100);
    if (!['g', 'ml'].includes(unit) || !Number.isFinite(grams) || grams <= 0 || grams > 5000 || (kcal !== null && kcal > 10000)) { setStatus('Revisa la cantidad y las calorías calculadas.'); return; }
    setSaving(true); setStatus('');
    try {
      const { error } = await supabase.rpc('assign_branded_product_with_metadata', {
        p_patient_id: patientId, p_day: date, p_time: String(form.get('time')),
        p_name: selectedProduct.name.slice(0, 120), p_brand: selectedProduct.brand?.slice(0, 120) ?? null,
        p_code: selectedProduct.barcode, p_amount: grams, p_unit: unit, p_energy: selectedProduct.energyKcal,
        p_protein: selectedProduct.proteinG, p_carbs: selectedProduct.carbohydratesG, p_fat: selectedProduct.fatG,
        p_photo_url: selectedProduct.photoUrl, p_allergens: selectedProduct.allergens ?? [],
        p_traces: selectedProduct.traces ?? [], p_labels: selectedProduct.labels ?? [],
      });
      if (error) throw error;
      setSelectedProduct(null); setStatus('Producto asignado con sus datos disponibles.'); onAssigned();
    } catch { setStatus('No se pudo asignar el producto. Revisa el horario y la conexión.'); }
    finally { setSaving(false); }
  }

  async function assignIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFood || saving) return;
    const form = new FormData(event.currentTarget);
    const grams = Number(form.get('grams'));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) { setStatus('Revisa la cantidad en gramos.'); return; }
    setSaving(true); setStatus('');
    try {
      const { error } = await supabase.rpc('create_and_assign_professional_recipe', {
        p_patient_id: patientId, p_day: date, p_time: String(form.get('time') ?? ''),
        p_title: selectedFood.name.slice(0, 120),
        p_description: String(form.get('instructions') ?? '').trim(), p_quantities: { [selectedFood.id]: grams },
      });
      if (error) throw error;
      setStatus('Alimento asignado a la dieta.'); setSelectedFood(null); onAssigned();
    } catch { setStatus('No se pudo asignar el alimento. Revisa el horario y la conexión.'); }
    finally { setSaving(false); }
  }

  return <section className="space-y-3 rounded-xl border border-line p-4">
    <h3 className="font-extrabold">Catálogo alimentario</h3>
    <label className="block font-bold">Buscar por platillo o ingrediente
      <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }}
        className="mt-1 block w-full rounded-lg border border-line px-3 py-2" placeholder="Ej. pollo, avena o brócoli" />
    </label>
    <button type="button" disabled={externalBusy || query.trim().length < 2} onClick={() => void searchProducts(query, 1)} className="rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50">{externalBusy ? 'Consultando productos…' : 'Buscar productos por nombre o marca'}</button>
    <p className="text-xs">La búsqueda de productos se envía a Open Food Facts. Escribe únicamente alimentos o marcas.</p>
    <ExternalRecipeSearch query={query} patientId={patientId} date={date} ingredients={composition} onAssigned={onAssigned} onRecipeSaved={() => setRecipeRefresh(value => value + 1)} />
    <label>Tipo <select className="rounded-lg border border-line p-2" value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }}><option value="all">Todos</option><option value="recipe">Recetas</option><option value="food">Ingredientes</option></select></label>
    {!recipes && !failed && <p role="status">Cargando recetario…</p>}
    {failed && <div role="alert">No se pudo cargar el recetario. <button className="underline" onClick={() => {
      setFailed(false);
      setAttempt((value) => value + 1);
    }}>Reintentar</button></div>}
    {results?.length === 0 && <p>No encontramos alimentos con esa búsqueda.</p>}
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {results?.slice(page * pageSize, (page + 1) * pageSize).map((result) => <li key={`${result.type}:${result.id}`}><button type="button" disabled={saving}
        aria-pressed={result.type === 'recipe' ? selected?.id === result.id : selectedFood?.id === result.id} onClick={() => {
          setStatus(""); setDraft({});
          if (result.type === 'recipe') { setSelected(recipes?.find(item => item.id === result.id) ?? null); setSelectedFood(null); }
          else { setSelectedFood(composition.find(item => item.id === result.id) ?? null); setSelected(null); }
        }}
        className="flex h-full w-full flex-col items-center gap-2 rounded-lg bg-fill p-3 text-center font-bold aria-pressed:outline-2 aria-pressed:outline-blue">
        {(() => {
          const photo = result.type === 'recipe' ? recipes?.find(item => item.id === result.id)?.photo_url : composition.find(item => item.id === result.id)?.photo_url;
          return photo ? <Image src={photo} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl">🍽</span>;
        })()}
        <span>{result.name}</span><span className="text-xs font-normal">{result.type === 'recipe' ? 'Receta' : 'Ingrediente'}</span>
      </button></li>)}
    </ul>
    {results && results.length > pageSize && <div className="flex gap-3"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(results.length / pageSize)}</span><button type="button" disabled={(page + 1) * pageSize >= results.length} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
    {selectedFood && <div className="space-y-2 rounded-lg bg-fill p-3"><h4 className="font-bold">Ingrediente · {selectedFood.name}</h4>{selectedFood.original_name && selectedFood.original_name !== selectedFood.name && <p>Descripción original: {selectedFood.original_name}</p>}<p>Valores por 100 g: {([['Energía',selectedFood.kcal,'kcal'],['Proteína',selectedFood.protein,'g'],['Carbohidratos',selectedFood.carbs,'g'],['Grasas',selectedFood.fat,'g']] as const).map(([label, value, unit]) => `${label}: ${value == null ? 'no disponible' : `${value} ${unit}`}`).join(' · ')}</p><p className="text-xs">{selectedFood.source_name ? <>Fuente: {selectedFood.source_name}. {selectedFood.source_url && <a className="underline" href={selectedFood.source_url} target="_blank" rel="noreferrer">Consultar fuente</a>} {selectedFood.energy_nutrient_id && ` · Identificador de energía USDA: ${selectedFood.energy_nutrient_id}.`}</> : 'Fuente nutricional pendiente de validación.'} Verifica la descripción y el estado de preparación antes de usarlo.</p></div>}
    {selectedFood && <form onSubmit={assignIngredient} className="space-y-2 rounded-lg border border-line p-3">
      <h4 className="font-bold">Asignar {selectedFood.name}</h4>
      <label className="block">Cantidad en gramos <input name="grams" type="number" min="0.1" max="5000" step="0.1" required className="rounded-lg border border-line p-2" /></label>
      <label className="block">Horario <input name="time" type="time" required className="rounded-lg border border-line p-2" /></label>
      <label className="block">Indicaciones <textarea name="instructions" maxLength={3000} className="w-full rounded-lg border border-line p-2" /></label>
      <p className="text-xs">La cantidad se guarda como un alimento de la dieta y aparece en la despensa. Si es un platillo preparado, no se desglosan sus ingredientes automáticamente.</p>
      <button disabled={saving} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">Asignar alimento</button>
    </form>}
    {externalError && <p role="alert">{externalError}</p>}
    {external?.stale && <p role="status">El proveedor no respondió. Mostramos resultados guardados{external.savedAt ? ` el ${new Date(external.savedAt).toLocaleString('es-MX')}` : ''}; revisa la etiqueta del producto.</p>}
    {external && <section className="space-y-2 rounded-lg border border-line p-3"><h4 className="font-bold">Productos · {external.query}</h4>{external.products.length === 0 && <p>Sin productos para esta búsqueda.</p>}{external.products.map(product => <div key={product.id} className="rounded-lg bg-fill p-2">{product.photoUrl && <Image src={product.photoUrl} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" />}<b>{product.name}</b><p>{product.brand ?? 'Marca no disponible'}</p><p>Por 100 g · {([['Energía', product.energyKcal, 'kcal'], ['Proteína', product.proteinG, 'g'], ['Carbohidratos', product.carbohydratesG, 'g'], ['Grasas', product.fatG, 'g']] as const).map(([label,value,unit]) => `${label}: ${value == null ? 'no disponible' : `${value} ${unit}`}`).join(' · ')}</p><button type="button" className="font-bold text-blue" onClick={() => setSelectedProduct(product)}>Elegir producto</button></div>)}<div className="flex gap-3"><button type="button" disabled={externalBusy || external.page === 1} onClick={() => void searchProducts(external.query, external.page - 1)}>Anterior</button><span>Página {external.page}</span><button type="button" disabled={externalBusy || !external.hasMore} onClick={() => void searchProducts(external.query, external.page + 1)}>Siguiente</button></div><p className="text-xs">Fuente: Open Food Facts; datos comunitarios. Los resultados son internacionales y deben revisarse en su etiqueta.</p></section>}
    {selectedProduct && <form onSubmit={assignProduct} className="space-y-2 rounded-lg border border-line p-3"><h4 className="font-bold">Asignar {selectedProduct.name}</h4>
      <p>{selectedProduct.mexico === true ? 'Reportado para México por Open Food Facts.' : selectedProduct.mexico === false ? 'Reportado para otros países; disponibilidad en México no confirmada.' : 'País de venta no informado.'}</p>
      <p>Alérgenos reportados: {selectedProduct.allergens?.length ? selectedProduct.allergens.join(', ') : 'sin información disponible'}.</p>
      <p>Trazas reportadas: {selectedProduct.traces?.length ? selectedProduct.traces.join(', ') : 'sin información disponible'}.</p>
      {Boolean(selectedProduct.labels?.length) && <p>Etiquetas del proveedor: {selectedProduct.labels.join(', ')}.</p>}
      <p className="text-xs">Se conservarán los nutrientes disponibles y su fuente. En la despensa se puede capturar el precio de la presentación por sucursal. Confirma en la etiqueta los alérgenos y si los valores son por 100 g o por 100 ml.</p><label className="block">Base de la etiqueta <select name="unit" required defaultValue="" className="rounded-lg border border-line p-2"><option value="">Seleccionar</option><option value="g">Por 100 g</option><option value="ml">Por 100 ml</option></select></label><label className="block">Cantidad en la unidad seleccionada <input name="grams" type="number" min="1" max="5000" required className="rounded-lg border border-line p-2" /></label><label className="block">Horario <input name="time" type="time" required className="rounded-lg border border-line p-2" /></label><button disabled={saving} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">Asignar producto</button></form>}
    {selected && <><form onSubmit={assign} className="space-y-3 rounded-lg bg-fill p-3">
      {selected.photo_url && <Image src={selected.photo_url} alt={selected.title} height={144} width={256} unoptimized className="h-36 w-64 rounded-lg object-cover" />}
      <h4 className="font-extrabold">{selected.title}</h4>
      <p>{selected.description}</p>
      {calculated && <p>Valores aproximados por receta · {([['energy', 'Energía', 'kcal'], ['protein', 'Proteína', 'g'], ['carbohydrates', 'Carbohidratos', 'g'], ['fat', 'Grasas', 'g'], ['fiber', 'Fibra', 'g']] as const).map(([key, label, unit]) => `${label}: ${calculated[key].known.toFixed(1)} ${unit}${calculated[key].complete ? '' : ' (parcial)'}`).join(' · ')}</p>}
      <p className="text-xs">Composición aproximada del catálogo actual, pendiente de validación de fuentes.</p>
      <fieldset className="space-y-2"><legend className="font-bold">Simular gramajes</legend>
        {selected.ingredients.map((item) => <label key={item.id} className="flex items-center justify-between gap-2">{item.name}
          <input type="number" min="0" max="5000" step="1" value={draft[item.id] ?? item.grams} className="w-24 rounded-lg border border-line p-2" onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isFinite(value) && value >= 0 && value <= 5000) setDraft(current => ({ ...current, [item.id]: value }));
          }} /> g
        </label>)}
        <button type="button" className="text-blue underline" onClick={() => setDraft({})}>Restablecer cantidades</button>
      </fieldset>
      <p className="text-xs">Los cambios se mantienen en esta pantalla hasta que asignes la receta. Al publicarla, se guardará una copia de sus cantidades y nutrientes aproximados.</p>
      <label className="block">Horario <input type="time" name="time" required disabled={saving} className="rounded-lg border border-line p-2" /></label>
      <button disabled={saving || selected.ingredients.every(item => (draft[item.id] ?? item.grams) === 0)} type="submit" className="rounded-xl bg-blue px-4 py-2 font-bold text-white disabled:opacity-50">
        {saving ? "Publicando…" : "Asignar receta"}
      </button>
    </form><RecipeOptimizer key={selected.id} recipe={selected} composition={composition} draft={draft} onProposal={setDraft} /></>}
    {status && <p role="status">{status}</p>}
    {recipes && <ProfessionalRecipes patientId={patientId} day={date} ingredients={composition} onAssigned={onAssigned} refreshKey={recipeRefresh} />}
  </section>;
}
