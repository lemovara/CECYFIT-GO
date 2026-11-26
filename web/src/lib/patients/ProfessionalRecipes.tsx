"use client";
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase/clients';
import { IngredientSelector } from './IngredientSelector';
import { RecipeOptimizer } from './RecipeOptimizer';
import { previewProfessionalDraft } from '@/lib/nutrition/professional-draft';

type Ingredient = { id: string; name: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
type RecipeVersion = {
  id: string; family_id: string; version: number; title: string; description: string;
  professional_recipe_photos: { photo_url: string } | null;
  nutrition_snapshot: { kcal: number; protein: number; carbs: number; fat: number; ingredients: { id: string; name: string; grams: number; source_name?: string | null }[] };
};
type Row = { id: string; grams: string };
const field = 'w-full rounded-lg border border-line bg-white px-3 py-2';

export function ProfessionalRecipes({ patientId, day, ingredients, onAssigned, refreshKey = 0 }: {
  patientId: string; day: string; ingredients: Ingredient[]; onAssigned: () => void; refreshKey?: number;
}) {
  const [versions, setVersions] = useState<RecipeVersion[]>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<RecipeVersion>();
  const [multiplier, setMultiplier] = useState('1');
  const [customizing, setCustomizing] = useState(false);
  const [customRows, setCustomRows] = useState<Row[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([{ id: '', grams: '' }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const preview = previewProfessionalDraft(rows, ingredients);
  const customPreview = customizing ? previewProfessionalDraft(customRows, ingredients) : null;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
    const term = query.trim().replace(/[%,_\\]/g, '');
    let request = supabase.from('professional_recipe_versions')
      .select('id,family_id,version,title,description,nutrition_snapshot,professional_recipe_photos(photo_url)')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(page * 25, page * 25 + 25);
    if (term) request = request.ilike('title', `%${term}%`);
    void Promise.resolve(request)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError('No se pudieron cargar tus recetas.');
        else { setHasMore(data.length > 25); setVersions(data.slice(0, 25) as unknown as RecipeVersion[]); setError(''); }
      }).catch(() => { if (active) setError('No se pudieron cargar tus recetas.'); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [attempt, query, page, refreshKey]);

  function beginNew() { setParent(null); setTitle(''); setDescription(''); setPhoto(null); setRows([{ id: '', grams: '' }]); setMessage(''); }
  function revise(recipe: RecipeVersion) {
    setParent(recipe.id); setTitle(recipe.title); setDescription(recipe.description); setPhoto(recipe.professional_recipe_photos?.photo_url ?? null);
    setRows(recipe.nutrition_snapshot.ingredients.map(item => ({ id: item.id, grams: String(item.grams) })));
    setMessage(`Editando una nueva versión a partir de la v${recipe.version}.`);
  }
  function duplicate(recipe: RecipeVersion) {
    setParent(null); setTitle(`Copia de ${recipe.title}`.slice(0, 120)); setDescription(recipe.description); setPhoto(recipe.professional_recipe_photos?.photo_url ?? null);
    setRows(recipe.nutrition_snapshot.ingredients.map(item => ({ id: item.id, grams: String(item.grams) })));
    setMessage('Edita y guarda esta copia como una receta independiente.');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (rows.some(row => !row.id || !ingredients.some(item => item.id === row.id) || !Number.isFinite(Number(row.grams)) || Number(row.grams) <= 0 || Number(row.grams) > 5000) || new Set(rows.map(row => row.id)).size !== rows.length) {
      setError('Elige ingredientes diferentes e indica cantidades mayores que cero y hasta 5000 g.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const quantities = Object.fromEntries(rows.map(row => [row.id, Number(row.grams)]));
      const { error: saveError } = await supabase.rpc('save_professional_recipe_with_photo', {
        p_title: title.trim(), p_description: description.trim(), p_quantities: quantities, p_parent_version: parent, p_photo_url: photo,
      });
      if (saveError) throw saveError;
      beginNew(); setSelected(undefined); setQuery(''); setPage(0); setMessage('Receta guardada en tu catálogo privado.'); setAttempt(value => value + 1);
    } catch { setError('No se pudo guardar la receta. Revisa los datos y la conexión.'); }
    finally { setBusy(false); }
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const time = String(new FormData(event.currentTarget).get('time') ?? '');
    const factor = Number(multiplier);
    if (customizing && !customPreview) { setError('Revisa los ingredientes y sus cantidades antes de publicar.'); return; }
    if (!customizing && (!Number.isFinite(factor) || factor < 0.1 || factor > 10 || selected.nutrition_snapshot.ingredients.some(item => Math.round(item.grams * factor * 1000) / 1000 <= 0 || item.grams * factor > 5000))) {
      setError('Revisa la cantidad: debe estar entre 0.1 y 10 recetas y cada ingrediente debe mantenerse hasta 5000 g.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: assignError } = customizing
        ? await supabase.rpc('assign_customized_professional_recipe', { p_patient_id: patientId, p_day: day, p_time: time, p_version_id: selected.id,
          p_quantities: Object.fromEntries(customRows.map(row => [row.id, Number(row.grams)])) })
        : await supabase.rpc('assign_scaled_professional_recipe', { p_patient_id: patientId, p_day: day, p_time: time, p_version_id: selected.id, p_multiplier: factor });
      if (assignError) throw assignError;
      setMessage(customizing ? 'Versión personalizada guardada y publicada en la dieta.' : 'Receta publicada en la dieta.');
      if (customizing) { setCustomizing(false); setPage(0); setAttempt(value => value + 1); }
      onAssigned();
    } catch (reason) {
      const code = reason && typeof reason === 'object' && 'code' in reason ? reason.code : null;
      setError(code === '23505' ? 'Ya existe una comida en ese horario. Elige otro.' : 'No se pudo publicar la receta. Revisa el horario y la ficha.');
    }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 rounded-xl border border-line p-4">
    <h3 className="font-extrabold">Mis recetas</h3>
    <p>Solo tú puedes consultar estas recetas. Los cambios crean una nueva versión y no alteran comidas ya asignadas.</p>
    <label className="block">Buscar mis recetas<input type="search" value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setPage(0); setVersions(undefined); }} className={field} placeholder="Nombre de la receta" /></label>
    {error && <p role="alert">{error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Actualizar</button></p>}
    {message && <p role="status">{message}</p>}
    {!versions && !error && <p>Cargando recetas…</p>}
    {versions?.length === 0 && <p>{query ? 'No encontramos recetas con ese nombre.' : 'Aún no hay recetas en esta página.'}</p>}
    <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{versions?.map(recipe => <button key={recipe.id} type="button" disabled={busy} aria-pressed={selected?.id === recipe.id} onClick={() => { setSelected(recipe); setMultiplier('1'); setCustomizing(false); setCustomRows([]); setMessage(''); setError(''); }} className="rounded-lg bg-fill p-2 text-left aria-pressed:outline-2 aria-pressed:outline-blue">{recipe.title} · v{recipe.version}</button>)}</div>
    {versions && (page > 0 || hasMore) && <div className="flex items-center gap-3"><button type="button" disabled={page === 0} onClick={() => { setVersions(undefined); setPage(value => value - 1); }}>Anterior</button><span>Página {page + 1}</span><button type="button" disabled={!hasMore} onClick={() => { setVersions(undefined); setPage(value => value + 1); }}>Siguiente</button></div>}
    {selected && <form onSubmit={assign} className="space-y-2 rounded-lg bg-fill p-3"><h4 className="font-bold">{selected.title} · v{selected.version}</h4>
      {selected.professional_recipe_photos?.photo_url && <Image src={selected.professional_recipe_photos.photo_url} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" />}
      <p className="whitespace-pre-wrap">{selected.description}</p>
      <ul>{selected.nutrition_snapshot.ingredients.map(item => <li key={item.id}>{item.name} · {item.grams} g · {item.source_name || 'fuente pendiente de validación'}</li>)}</ul>
      <p>{selected.nutrition_snapshot.kcal} kcal · proteína {selected.nutrition_snapshot.protein} g · carbohidratos {selected.nutrition_snapshot.carbs} g · grasas {selected.nutrition_snapshot.fat} g</p>
      <p className="text-xs">Estimación para los ingredientes y cantidades indicados; requiere revisión profesional.</p>
      {!customizing ? <>
        <label className="block">Cantidad de recetas completas <input type="number" min="0.1" max="10" step="0.01" required disabled={busy} value={multiplier} onChange={event => setMultiplier(event.target.value)} className="rounded-lg border border-line bg-white p-2" /></label>
        {Number(multiplier) >= 0.1 && Number(multiplier) <= 10 && <p className="text-sm">Estimación asignada: {(selected.nutrition_snapshot.kcal * Number(multiplier)).toFixed(1)} kcal · proteína {(selected.nutrition_snapshot.protein * Number(multiplier)).toFixed(1)} g · carbohidratos {(selected.nutrition_snapshot.carbs * Number(multiplier)).toFixed(1)} g · grasas {(selected.nutrition_snapshot.fat * Number(multiplier)).toFixed(1)} g. Los gramajes se ajustarán en la misma proporción.</p>}
        <button type="button" disabled={busy} className="rounded-lg border border-line p-2 text-blue" onClick={() => { setCustomRows(selected.nutrition_snapshot.ingredients.map(item => ({ id:item.id, grams:String(item.grams) }))); setCustomizing(true); }}>Personalizar ingredientes</button>
      </> : <>
        <p>Se guardará una nueva versión sin modificar la original. Los valores se recalculan con el catálogo actual.</p>
        {customRows.map((row, index) => <div key={index} className="grid grid-cols-2 gap-2 rounded-lg bg-white p-2">
          <IngredientSelector ingredients={ingredients} value={row.id} onChange={id => setCustomRows(current => current.map((item, i) => i === index ? { ...item, id } : item))} />
          <label>Cantidad (g)<input type="number" min="0.1" max="5000" step="0.1" required disabled={busy} value={row.grams} className={field} onChange={event => { const grams = event.target.value; setCustomRows(current => current.map((item, i) => i === index ? { ...item, grams } : item)); }} /></label>
          {customRows.length > 1 && <button type="button" disabled={busy} className="text-left font-bold text-red-700" onClick={() => setCustomRows(current => current.filter((_, i) => i !== index))}>Quitar ingrediente</button>}
        </div>)}
        {customRows.length < 30 && <button type="button" disabled={busy} className="rounded-lg border border-line p-2 text-blue" onClick={() => setCustomRows(current => [...current, { id:'', grams:'' }])}>Agregar ingrediente</button>}
        {customPreview ? <p>Estimación: {([['energy','Energía','kcal'],['protein','Proteína','g'],['carbohydrates','Carbohidratos','g'],['fat','Grasas','g'],['fiber','Fibra','g']] as const).map(([key,label,unit]) => `${label}: ${customPreview[key].known.toFixed(1)} ${unit}${customPreview[key].complete ? '' : ' (parcial)'}`).join(' · ')}</p> : <p>Selecciona ingredientes diferentes del catálogo y cantidades válidas para calcular.</p>}
        <button type="button" disabled={busy} className="rounded-lg border border-line p-2 text-blue" onClick={() => setCustomizing(false)}>Usar proporción original</button>
      </>}
      <label>Horario <input name="time" type="time" required disabled={busy} className="rounded-lg border border-line bg-white p-2" /></label>
      <button type="submit" disabled={busy} className="ml-2 rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">Asignar al paciente</button>
      <button type="button" disabled={busy} className="ml-2 rounded-lg border border-line p-2 text-blue" onClick={() => revise(selected)}>Crear nueva versión</button>
      <button type="button" disabled={busy} className="ml-2 rounded-lg border border-line p-2 text-blue" onClick={() => duplicate(selected)}>Duplicar receta</button>
    </form>}
    {selected && customizing && customPreview && <RecipeOptimizer key={`assign:${selected.id}:${customRows.map(row => row.id).join(':')}`} recipe={{ id:`assign-${selected.id}`,ingredients:customRows.map(row => ({ id:row.id,name:ingredients.find(item => item.id === row.id)!.name,grams:Number(row.grams) })) }}
      composition={ingredients} draft={Object.fromEntries(customRows.map(row => [row.id,Number(row.grams)]))} minimum={0.1}
      onProposal={values => setCustomRows(current => current.map(row => ({ ...row,grams:String(values[row.id]) })))} />}
    <form onSubmit={save} className="space-y-3 rounded-lg bg-fill p-3"><h4 className="font-bold">{parent ? 'Nueva versión de receta' : 'Crear receta propia'}</h4>
      {photo && <div><Image src={photo} alt="Imagen de la receta" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" /><button type="button" onClick={() => setPhoto(null)} className="text-blue underline">Quitar imagen</button></div>}
      <label className="block">Nombre<input className={field} required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="block">Preparación e indicaciones<textarea className={field} maxLength={3000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
      {rows.map((row, index) => <div key={index} className="grid grid-cols-2 gap-2"><IngredientSelector ingredients={ingredients} value={row.id} onChange={id => setRows(current => current.map((item, i) => i === index ? { ...item, id } : item))} />
        <label>Cantidad (g)<input className={field} type="number" min="0.1" max="5000" step="0.1" required value={row.grams} onChange={event => { const grams = event.target.value; setRows(current => current.map((item, i) => i === index ? { ...item, grams } : item)); }} /></label>
        {rows.length > 1 && <button type="button" className="text-left text-red-700" onClick={() => setRows(current => current.filter((_, i) => i !== index))}>Quitar ingrediente</button>}
      </div>)}
      {preview ? <div className="rounded-lg bg-white p-3"><p className="font-bold">Estimación del borrador completo</p>
        <p>{([['energy','Energía','kcal'],['protein','Proteína','g'],['carbohydrates','Carbohidratos','g'],['fat','Grasas','g'],['fiber','Fibra','g']] as const).map(([key,label,unit]) => `${label}: ${preview[key].known.toFixed(1)} ${unit}${preview[key].complete ? '' : ' (parcial)'}`).join(' · ')}</p>
      </div> : <p className="text-xs">Selecciona ingredientes diferentes y cantidades para calcular el borrador.</p>}
      <div className="flex flex-wrap gap-2">{rows.length < 30 && <button type="button" disabled={busy} className="rounded-lg border border-line p-2" onClick={() => setRows(current => [...current, { id: '', grams: '' }])}>Agregar ingrediente</button>}
        <button type="submit" disabled={busy} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : parent ? 'Guardar nueva versión' : 'Guardar receta'}</button>
        {parent && <button type="button" disabled={busy} className="rounded-lg border border-line p-2" onClick={beginNew}>Crear otra receta</button>}</div>
      <p className="text-xs">Solo se pueden usar ingredientes del catálogo disponible. Verifica su estado de preparación y sus fuentes antes de guardar.</p>
    </form>
    {preview && <RecipeOptimizer key={`own:${rows.map(row => row.id).join(':')}`} recipe={{ id:'own-draft',ingredients:rows.map(row => ({ id:row.id,name:ingredients.find(item => item.id === row.id)!.name,grams:Number(row.grams) })) }}
      composition={ingredients} draft={Object.fromEntries(rows.map(row => [row.id,Number(row.grams)]))} minimum={0.1}
      onProposal={values => setRows(current => current.map(row => ({ ...row,grams:String(values[row.id]) })))} />}
  </section>;
}
