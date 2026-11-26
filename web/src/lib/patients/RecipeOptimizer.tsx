"use client";
import { useState, type FormEvent } from 'react';
import { optimizeRecipe, type MacroTargets } from '@/lib/nutrition/engine';

type Food = { id: string; protein: number | null; carbs: number | null; fat: number | null };
type Recipe = { id: string; ingredients: { id: string; name: string; grams: number }[] };
export function RecipeOptimizer({ recipe, composition, draft, onProposal, minimum = 0 }: { recipe: Recipe; composition: Food[]; draft: Record<string, number>; onProposal: (value: Record<string, number>) => void; minimum?: number }) {
  const [message, setMessage] = useState('');
  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targets: MacroTargets = {};
    for (const key of ['protein','carbohydrates','fat'] as const) {
      const value = String(form.get(key) ?? '').trim();
      if (value) targets[key] = Number(value);
    }
    try {
      const result = optimizeRecipe(recipe.ingredients.map(item => {
        const food = composition.find(entry => entry.id === item.id);
        return { id:item.id,grams:draft[item.id] ?? item.grams,min:Number(form.get(`min:${item.id}`)),
          max:Number(form.get(`max:${item.id}`)),step:Number(form.get(`step:${item.id}`)),locked:form.has(`lock:${item.id}`),
          nutrients:{ protein:food?.protein,carbohydrates:food?.carbs,fat:food?.fat } };
      }),targets);
      onProposal(Object.fromEntries(result.ingredients.map(item => [item.id,Math.round(item.grams * 1000) / 1000])));
      const labels = { protein:'Proteínas',carbohydrates:'Carbohidratos',fat:'Grasas' } as const;
      const comparison = (Object.keys(targets) as (keyof MacroTargets)[]).map(key =>
        `${labels[key]}: meta ${targets[key]} g, propuesta ${result.totals[key].known.toFixed(1)} g${result.unmet.includes(key) ? ' (fuera de tolerancia)' : ''}`);
      setMessage(`${result.notice} ${comparison.join(' · ')}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo calcular la propuesta.'); }
  }
  return <div className="space-y-2 rounded-lg border border-line bg-white p-3">
    <h4 className="font-bold">Propuesta por metas (gramos por receta)</h4>
    <p className="text-xs">Indica límites para cada ingrediente y revisa la propuesta antes de guardar. Los datos son aproximados.</p>
    <div className="grid gap-2 sm:grid-cols-3">{([['protein','Proteínas'],['carbohydrates','Carbohidratos'],['fat','Grasas']] as const).map(([key,label]) => <label key={key}>{label}<input form={`optimizer-${recipe.id}`} name={key} type="number" min="0" step="0.1" className="block w-full rounded-lg border border-line p-2" /></label>)}</div>
    {recipe.ingredients.map(item => <div key={item.id} className="grid grid-cols-2 gap-2 sm:grid-cols-4"><b>{item.name}</b>
      <label>Mín. (g)<input form={`optimizer-${recipe.id}`} required name={`min:${item.id}`} type="number" min={minimum} step="0.1" defaultValue={item.grams} className="block w-full rounded-lg border p-2" /></label>
      <label>Máx. (g)<input form={`optimizer-${recipe.id}`} required name={`max:${item.id}`} type="number" min={minimum} max="5000" step="0.1" defaultValue={item.grams} className="block w-full rounded-lg border p-2" /></label>
      <label>Paso (g)<input form={`optimizer-${recipe.id}`} required name={`step:${item.id}`} type="number" min="0.1" step="0.1" defaultValue="5" className="block w-full rounded-lg border p-2" /></label>
      <label><input form={`optimizer-${recipe.id}`} name={`lock:${item.id}`} type="checkbox" /> Bloquear</label>
    </div>)}
    <button form={`optimizer-${recipe.id}`} type="submit" className="rounded-lg border border-line p-2 font-bold text-blue">Calcular propuesta</button>
    {message && <p role="status">{message}</p>}
    <form id={`optimizer-${recipe.id}`} onSubmit={propose} />
  </div>;
}
