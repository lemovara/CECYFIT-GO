"use client";
import { useId, useState } from 'react';
import { searchLocalFoods } from '@/lib/nutrition/local-search';

type Ingredient = { id: string; name: string; original_name?: string | null };
export function IngredientSelector({ ingredients, value, onChange }: {
  ingredients: Ingredient[]; value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const id = useId();
  const results = searchLocalFoods(ingredients.map(item => ({ type: 'food' as const, id: item.id, name: item.name,
    terms: item.original_name ? [item.original_name] : [] })), query, 'food');
  const selected = ingredients.find(item => item.id === value);
  return <div className="space-y-1">
    <label htmlFor={`${id}-search`} className="block">Buscar ingrediente</label>
    <input id={`${id}-search`} type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)}
      placeholder="Ej. avena, jitomate" className="w-full rounded-lg border border-line bg-white px-3 py-2" />
    <label htmlFor={`${id}-select`} className="block">Ingrediente</label>
    <select id={`${id}-select`} required value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2">
      <option value="">Seleccionar ingrediente</option>
      {value && !selected && <option value={value}>Ingrediente no disponible; selecciona otro</option>}
      {selected && !results.some(item => item.id === selected.id) && <option value={selected.id}>{selected.name} (seleccionado)</option>}
      {results.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {query && results.length === 0 && <p className="text-xs">No encontramos ingredientes con ese nombre.</p>}
  </div>;
}
