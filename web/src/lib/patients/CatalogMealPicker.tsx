"use client";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/clients";

type Recipe = {
  id: string; title: string; description: string; photo_url: string | null;
  kcal: number; protein: number; carbs: number; fat: number; fiber: number;
  ingredients: { id: string; name: string; grams: number; photo_url: string | null }[];
};
const normalize = (value: string) => value.toLocaleLowerCase("es-MX").normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function CatalogMealPicker({ patientId, date, onAssigned }: {
  patientId: string; date: string; onAssigned: () => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from("recipe_catalog").select("*").order("title").then(({data,error}) => {
      if (!active) return;
      if (error) setFailed(true);
      else setRecipes(data as Recipe[]);
    });
    return () => { active = false; };
  }, [attempt]);

  const terms = normalize(query.trim()).split(/\s+/);
  const results = recipes?.filter((recipe) => {
    const text = normalize([recipe.title, recipe.description, ...recipe.ingredients.map(({name}) => name)].join(" "));
    return terms.every((term) => text.includes(term));
  });

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const time = String(new FormData(event.currentTarget).get("time") ?? "");
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase.rpc("assign_catalog_meal", {
        p_patient_id: patientId, p_day: date, p_time: time, p_recipe_id: selected.id,
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

  return <section className="space-y-3 rounded-xl border border-line p-4">
    <h3 className="font-extrabold">Recetario</h3>
    <label className="block font-bold">Buscar por platillo o ingrediente
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-line px-3 py-2" placeholder="Ej. pollo, avena o brócoli" />
    </label>
    {!recipes && !failed && <p role="status">Cargando recetario…</p>}
    {failed && <div role="alert">No se pudo cargar el recetario. <button className="underline" onClick={() => {
      setFailed(false);
      setAttempt((value) => value + 1);
    }}>Reintentar</button></div>}
    {results?.length === 0 && <p>No encontramos recetas con esa búsqueda.</p>}
    <ul className="grid gap-2 sm:grid-cols-2">
      {results?.map((recipe) => <li key={recipe.id}><button type="button" disabled={saving}
        aria-pressed={selected?.id === recipe.id} onClick={() => { setSelected(recipe); setStatus(""); }}
        className="w-full rounded-lg bg-fill p-2 text-left font-bold aria-pressed:outline-2 aria-pressed:outline-blue">
        {recipe.title} · {recipe.kcal} kcal
      </button></li>)}
    </ul>
    {selected && <form onSubmit={assign} className="space-y-3 rounded-lg bg-fill p-3">
      {selected.photo_url && <Image src={selected.photo_url} alt={selected.title} height={144} width={256} unoptimized className="h-36 w-64 rounded-lg object-cover" />}
      <h4 className="font-extrabold">{selected.title}</h4>
      <p>{selected.description}</p>
      <p>{selected.kcal} kcal · Proteína {selected.protein} g · Carbohidratos {selected.carbs} g · Grasas {selected.fat} g · Fibra {selected.fiber} g</p>
      <ul>{selected.ingredients.map((item) => <li key={item.id}>{item.name} · {item.grams} g</li>)}</ul>
      <label className="block">Horario <input type="time" name="time" required disabled={saving} className="rounded-lg border border-line p-2" /></label>
      <button disabled={saving} type="submit" className="rounded-xl bg-blue px-4 py-2 font-bold text-white">
        {saving ? "Publicando…" : "Asignar receta"}
      </button>
    </form>}
    {status && <p role="status">{status}</p>}
  </section>;
}
