"use client";

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase/clients';
import type { ExternalRecipe, ExternalRecipeDetail } from '@/lib/nutrition/myplate';
import { calculateNutrition } from '@/lib/nutrition/engine';
import { suggestIngredients } from '@/lib/nutrition/ingredient-suggestions';
import { portionGrams } from '@/lib/nutrition/recipe-portions';
import { IngredientSelector } from './IngredientSelector';

type Ingredient = { id: string; name: string; original_name?: string | null; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
export function ExternalRecipeSearch({ query, patientId, date, ingredients, onAssigned, onRecipeSaved }: { query: string; patientId: string; date: string; ingredients: Ingredient[]; onAssigned: () => void; onRecipeSaved: () => void }) {
  const [result, setResult] = useState<{ query: string; page: number; searched: string; recipes: ExternalRecipe[]; total: number | null; hasMore: boolean }>();
  const [selected, setSelected] = useState<ExternalRecipe>();
  const [detail, setDetail] = useState<{ id: string; value?: ExternalRecipeDetail; error?: string; loading?: boolean }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const [instructions, setInstructions] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [recipeServings, setRecipeServings] = useState('1');
  const [assignedServings, setAssignedServings] = useState('1');
  const [rows, setRows] = useState<{ id: string; grams: string; sourceText?: string }[]>([{ id: '', grams: '' }]);
  const activeRequest = useRef(false);
  const detailRequest = useRef(0);
  const recipeForm = useRef<HTMLFormElement>(null);
  const assignedRows = rows.map(row => ({ ...row, assignedGrams: portionGrams(Number(row.grams), Number(recipeServings), Number(assignedServings)) }));
  const validRows = assignedRows.every(row => row.id && ingredients.some(item => item.id === row.id) && row.assignedGrams !== null)
    && new Set(rows.map(row => row.id)).size === rows.length;
  const preview = validRows ? calculateNutrition(assignedRows.map(row => {
    const item = ingredients.find(ingredient => ingredient.id === row.id)!;
    return { id: row.id, grams: row.assignedGrams!, nutrients: { energy: item.kcal, protein: item.protein, carbohydrates: item.carbs, fat: item.fat, fiber: item.fiber } };
  }), 1) : null;

  const search = useCallback(async (term: string, page: number) => {
    if (activeRequest.current || (term.trim().length > 0 && term.trim().length < 2) || term.trim().length > 80) return;
    activeRequest.current = true; detailRequest.current++; setBusy(true); setMessage(''); setSelected(undefined); setDetail(undefined);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Inicia sesión para buscar recetas.');
      const response = await fetch(`/api/food/recipes?q=${encodeURIComponent(term.trim())}&page=${page}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo buscar.');
      setResult({ query: term, page, recipes: body.recipes, searched: body.searched, total: body.total, hasMore: body.hasMore });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo buscar.'); }
    finally { activeRequest.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void search('', 1), 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function loadDetail(recipe: ExternalRecipe) {
    const sequence = ++detailRequest.current;
    setDetail({ id: recipe.id, loading: true });
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Inicia sesión para consultar la receta.');
      const response = await fetch(`/api/food/recipes/detail?id=${encodeURIComponent(recipe.id)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo consultar la receta.');
      if (sequence === detailRequest.current) setDetail({ id: recipe.id, value: body });
    } catch (error) {
      if (sequence === detailRequest.current) setDetail({ id: recipe.id, error: error instanceof Error ? error.message : 'No se pudo consultar la receta.' });
    }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || activeRequest.current) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const ingredientText = String(form.get('ingredients') ?? '').trim();
    const instructions = String(form.get('instructions') ?? '').trim();
    const calories = String(form.get('kcal') ?? '').trim();
    const notes = `${instructions}\nFuente de referencia: ${selected.url}`;
    if (!name || !instructions || notes.length > 3000 || (mode === 'manual' && (!ingredientText || (calories && (!/^\d+$/.test(calories) || Number(calories) > 10000)))) || (mode === 'catalog' && !validRows)) {
      setMessage('Revisa el nombre, ingredientes, instrucciones y calorías.'); return;
    }
    activeRequest.current = true; setBusy(true); setMessage('');
    try {
      const { error } = mode === 'catalog'
        ? await supabase.rpc('create_and_assign_external_recipe', {
          p_patient_id: patientId, p_day: date, p_time: String(form.get('time') ?? ''), p_title: name,
          p_description: notes, p_quantities: Object.fromEntries(assignedRows.map(row => [row.id, row.assignedGrams])), p_photo_url: selected.photo,
        })
        : await supabase.rpc('assign_external_manual_meal', {
          p_patient_id: patientId, p_day: date, p_time: String(form.get('time') ?? ''),
          p_title: name, p_ingredients: ingredientText, p_notes: notes, p_kcal: calories ? Number(calories) : null, p_photo_url: selected.photo,
        });
      if (error) throw error;
      setMessage(mode === 'catalog' ? 'Receta guardada y publicada con sus ingredientes.' : 'Comida manual publicada en la dieta.'); setSelected(undefined); setRows([{ id: '', grams: '' }]); onAssigned();
    } catch { setMessage('No se pudo publicar. Revisa el horario, la conexión y la ficha.'); }
    finally { activeRequest.current = false; setBusy(false); }
  }

  async function saveTemplate() {
    if (!selected || !recipeForm.current || activeRequest.current || mode !== 'catalog') return;
    const form = new FormData(recipeForm.current);
    const name = String(form.get('name') ?? '').trim();
    const preparation = instructions.trim();
    const notes = `${preparation}\nFuente de referencia: ${selected.url}`;
    const valid = rows.length > 0 && new Set(rows.map(row => row.id)).size === rows.length && rows.every(row =>
      row.id && ingredients.some(food => food.id === row.id) && row.grams.trim() !== '' && Number.isFinite(Number(row.grams)) && Number(row.grams) > 0 && Number(row.grams) <= 5000);
    if (!name || name.length > 120 || !preparation || notes.length > 3000 || !valid) {
      setMessage('Revisa el nombre, la preparación y los ingredientes con sus gramos para la receta completa.'); return;
    }
    activeRequest.current = true; setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('save_professional_recipe_with_photo', { p_title: name, p_description: notes,
        p_quantities: Object.fromEntries(rows.map(row => [row.id, Number(row.grams)])), p_parent_version: null, p_photo_url: selected.photo });
      if (error) throw error;
      setMessage('Receta completa guardada en Mis recetas. Puedes asignarla más tarde.');
      onRecipeSaved();
    } catch { setMessage('No se pudo guardar la receta. Revisa los ingredientes y la conexión.'); }
    finally { activeRequest.current = false; setBusy(false); }
  }

  return <section className="space-y-3 rounded-lg border border-line p-3">
    <h4 className="font-extrabold">Explorar recetas externas</h4>
    <p>Consulta en vivo recetas de la colección USDA MyPlate Kitchen, conservadas por <a className="text-blue underline" href="https://myplate.food/recipes" target="_blank" rel="noreferrer">MyPlate.food</a>, proveedor independiente. Escribe únicamente alimentos, sin datos personales.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void search('', 1)} className="rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50">Explorar recetas</button>
      <button type="button" disabled={busy || query.trim().length < 2 || query.trim().length > 80} onClick={() => void search(query, 1)} className="rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50">{busy ? 'Consultando…' : 'Buscar recetas externas'}</button></div>
    {message && <p role="status">{message}</p>}
    {result && <><p>{result.query ? `Consulta: ${result.query}` : 'Explorar recetario'}{result.searched !== result.query && result.searched && ` · términos usados: ${result.searched}`}{result.total !== null && ` · ${result.total} resultados del proveedor`}</p>
      {result.recipes.length === 0 && <p>No se encontraron recetas para estos términos.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{result.recipes.map(recipe => <li key={recipe.id} className="rounded-lg bg-fill p-3 text-center">
        <button type="button" className="flex w-full flex-col items-center gap-2 font-bold text-blue" aria-label={`Preparar asignación: ${recipe.title}`} onClick={() => { setSelected(recipe); setRows([{ id: '', grams: '' }]); setRecipeServings('1'); setAssignedServings('1'); setInstructions(''); setIngredientText(''); setMode('catalog'); setMessage(''); void loadDetail(recipe); }}>
          {recipe.photo ? <Image src={recipe.photo} alt="" width={100} height={100} unoptimized className="h-24 w-24 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl">🍽</span>}
          <span>{recipe.title}</span></button>
        <a className="text-sm text-blue underline" href={recipe.url} target="_blank" rel="noreferrer">Ver receta</a>
      </li>)}</ul>
      <div className="flex items-center gap-3"><button type="button" disabled={busy || result.page === 1} onClick={() => void search(result.query, result.page - 1)}>Anterior</button><span>Página {result.page}</span><button type="button" disabled={busy || !result.hasMore} onClick={() => void search(result.query, result.page + 1)}>Siguiente</button></div>
    </>}
    {selected && <form ref={recipeForm} key={selected.id} onSubmit={assign} className="space-y-2 rounded-lg border border-line p-3">
      <h4 className="font-bold">Preparar asignación</h4>
      {selected.photo && <Image src={selected.photo} alt="" width={100} height={100} unoptimized className="h-24 w-24 rounded-full object-cover" />}
      <p>Revisa el enlace y define las cantidades e indicaciones que autorices. Con ingredientes del catálogo se calcularán los nutrientes y se actualizará la despensa.</p>
      {detail?.id === selected.id && detail.loading && <p role="status">Consultando ingredientes y preparación…</p>}
      {detail?.id === selected.id && detail.error && <p role="alert">{detail.error}</p>}
      {detail?.id === selected.id && detail.error && <button type="button" onClick={() => void loadDetail(selected)} className="rounded-lg border border-line p-2 font-bold text-blue">Reintentar consulta</button>}
      {detail?.id === selected.id && detail.value && <div className="space-y-2 rounded-lg bg-fill p-3">
        <p className="font-bold">Referencia del proveedor en {detail.value.language === 'es' ? 'español' : 'inglés'} · {detail.value.servings || 'porciones no indicadas'}</p>
        <ul className="space-y-2">{detail.value.ingredients.map((item, index) => {
          const candidates = mode === 'catalog' ? suggestIngredients(item.text, ingredients) : [];
          return <li key={index} className="rounded-lg bg-white p-2"><p>{item.text}{item.note ? ` (${item.note})` : ''}</p>
            {candidates.length > 0 && <div className="mt-1 flex flex-wrap items-center gap-1"><span className="text-xs">Opciones del catálogo:</span>{candidates.map(candidate => {
              const added = rows.some(row => row.id === candidate.id);
              return <button key={candidate.id} type="button" disabled={added || rows.length >= 30 && rows.every(row => row.id)}
                className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-blue disabled:opacity-50"
                onClick={() => setRows(current => {
                  if (current.some(row => row.id === candidate.id)) return current;
                  const empty = current.findIndex(row => !row.id && !row.grams);
                  if (empty >= 0) return current.map((row, i) => i === empty ? { id: candidate.id, grams: '', sourceText: item.text } : row);
                  return current.length < 30 ? [...current, { id: candidate.id, grams: '', sourceText: item.text }] : current;
                })}>{added ? 'Agregado: ' : 'Elegir: '}{candidate.name}</button>;
            })}</div>}
          </li>;
        })}</ul>
        {mode === 'catalog' && <p className="text-xs">Las opciones son sugerencias por nombre. Comprueba que sean el alimento y la preparación correctos; captura los gramos de cada uno.</p>}
        <p className="whitespace-pre-wrap">{detail.value.directions}</p>
        <button type="button" disabled={detail.value.directions.length > 2800} className="rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50" onClick={() => setInstructions(detail.value!.directions)}>Usar preparación en indicaciones</button>
        {mode === 'manual' && <button type="button" disabled={detail.value.ingredients.map(item => item.text + (item.note ? ` (${item.note})` : '')).join('\n').length > 3000} className="ml-2 rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50" onClick={() => setIngredientText(detail.value!.ingredients.map(item => item.text + (item.note ? ` (${item.note})` : '')).join('\n'))}>Usar ingredientes como texto</button>}
        <p className="text-xs">Las cantidades son las del proveedor. Consulta la <a className="text-blue underline" href={selected.url} target="_blank" rel="noreferrer">versión en español</a> y confirma los gramajes antes de asignar.</p>
      </div>}
      <label className="block">Nombre <input name="name" required maxLength={120} defaultValue={selected.title} className="w-full rounded-lg border border-line p-2" /></label>
      <label className="block">Tipo de asignación <select value={mode} onChange={event => setMode(event.target.value as 'catalog' | 'manual')} className="rounded-lg border border-line p-2"><option value="catalog">Ingredientes del catálogo</option><option value="manual">Texto manual</option></select></label>
      {mode === 'catalog' ? <>
        <fieldset className="grid gap-2 rounded-lg bg-fill p-3 sm:grid-cols-2"><legend className="font-bold">Porciones</legend>
          <label>La receta completa rinde <input type="number" min="1" max="100" step="1" required value={recipeServings} onChange={event => setRecipeServings(event.target.value)} className="w-full rounded-lg border border-line p-2" /> porciones</label>
          <label>Asignar al paciente <input type="number" min="0.1" max="100" step="0.1" required value={assignedServings} onChange={event => setAssignedServings(event.target.value)} className="w-full rounded-lg border border-line p-2" /> porciones</label>
          <p className="text-xs sm:col-span-2">Introduce abajo los gramos de la receta completa. Verifica el rendimiento indicado por el proveedor; las cantidades asignadas se calculan con estas porciones.</p>
        </fieldset>
        {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-2">
          {row.sourceText && <p className="text-xs sm:col-span-2">Referencia: {row.sourceText}</p>}
          <IngredientSelector ingredients={ingredients} value={row.id} onChange={id => setRows(current => current.map((item, i) => i === index ? { ...item, id } : item))} />
          <label>Gramos en la receta completa <input required type="number" min="0.1" max="5000" step="0.1" value={row.grams} onChange={event => { const grams = event.target.value; setRows(current => current.map((item, i) => i === index ? { ...item, grams } : item)); }} className="w-full rounded-lg border border-line p-2" />
            {assignedRows[index].assignedGrams !== null ? <span className="block text-xs">Se asignarán {assignedRows[index].assignedGrams} g</span> : row.grams && <span className="block text-xs text-red-700">Revisa los gramos y las porciones; el resultado debe estar entre 0.1 y 5000 g.</span>}</label>
          {rows.length > 1 && <button type="button" className="text-left text-red-700" onClick={() => setRows(current => current.filter((_, i) => i !== index))}>Quitar ingrediente</button>}
        </div>)}
        {rows.length < 30 && <button type="button" className="rounded-lg border border-line p-2" onClick={() => setRows(current => [...current, { id: '', grams: '' }])}>Agregar ingrediente</button>}
        {preview && <p>Estimación: {([['energy','Energía','kcal'],['protein','Proteína','g'],['carbohydrates','Carbohidratos','g'],['fat','Grasas','g'],['fiber','Fibra','g']] as const).map(([key,label,unit]) => `${label}: ${preview[key].known.toFixed(1)} ${unit}${preview[key].complete ? '' : ' (parcial)'}`).join(' · ')}</p>}
        <p className="text-xs">La receta se guardará en tu catálogo privado. Comprueba el estado de cada ingrediente y su composición.</p>
      </> : <><label className="block">Ingredientes y cantidades <textarea name="ingredients" required maxLength={3000} value={ingredientText} onChange={event => setIngredientText(event.target.value)} className="w-full rounded-lg border border-line p-2" /></label>
        <p className="text-xs">El texto manual no genera automáticamente nutrientes ni productos de despensa.</p></>}
      <label className="block">Indicaciones <textarea name="instructions" required maxLength={2800} value={instructions} onChange={event => setInstructions(event.target.value)} className="w-full rounded-lg border border-line p-2" /></label>
      {mode === 'manual' && <label className="block">Calorías para la cantidad asignada (opcional) <input name="kcal" type="number" min="0" max="10000" step="1" className="rounded-lg border border-line p-2" /></label>}
      <label className="block">Horario <input name="time" type="time" required className="rounded-lg border border-line p-2" /></label>
      <button disabled={busy} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">Publicar comida</button>
      {mode === 'catalog' && <button type="button" disabled={busy} onClick={() => void saveTemplate()} className="ml-2 rounded-lg border border-line p-2 font-bold text-blue disabled:opacity-50">Guardar receta completa para después</button>}
    </form>}
  </section>;
}
