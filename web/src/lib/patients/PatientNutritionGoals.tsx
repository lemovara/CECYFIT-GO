"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase/clients';
import type { summarizeDay } from '@/lib/nutrition/daily-summary';

type Key = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
type Goal = { effective_on: string } & Record<Key, number | null>;
const fields = [['kcal','Energía','kcal',10000],['protein','Proteína','g',2000],['carbs','Carbohidratos','g',2000],['fat','Grasas','g',2000],['fiber','Fibra','g',2000]] as const;
const input = 'w-full rounded-lg border border-line bg-white p-2';

export function PatientNutritionGoals({ patientId, date, today, canEdit, summary }: {
  patientId: string; date: string; today: string; canEdit: boolean; summary: ReturnType<typeof summarizeDay> | null;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ date: string; attempt: number; goal: Goal | null; error?: boolean }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!date) return;
    let active = true;
    void supabase.from('patient_nutrition_goals').select('effective_on,kcal,protein,carbs,fat,fiber')
      .eq('patient_id',patientId).lte('effective_on',date).order('effective_on',{ ascending:false })
      .order('created_at',{ ascending:false }).order('id',{ ascending:false }).limit(1).maybeSingle()
      .then(({ data,error }) => { if (active) setResult({ date,attempt,goal: data as Goal | null,error:Boolean(error) }); });
    return () => { active = false; };
  },[patientId,date,attempt]);
  const current = result?.date === date && result.attempt === attempt ? result : undefined;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canEdit) return;
    const form = event.currentTarget, values = new FormData(form);
    const effective = String(values.get('effective_on') ?? '');
    const targets = Object.fromEntries(fields.map(([key]) => {
      const value = String(values.get(key) ?? '').trim();
      return [key,value ? Number(value) : null];
    })) as Record<Key,number | null>;
    if (effective < today || !/^\d{4}-\d{2}-\d{2}$/.test(effective) || Object.values(targets).every(value => value === null) ||
      fields.some(([key,,,max]) => targets[key] !== null && (!Number.isFinite(targets[key]) || targets[key]! < 0 || targets[key]! > max))) {
      setMessage('Indica una fecha vigente y al menos una meta válida.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('patient_nutrition_goals').insert({ patient_id: patientId,effective_on: effective,...targets });
      if (error) throw error;
      form.reset(); setMessage('Metas guardadas. Los días anteriores conservan sus metas.'); setAttempt(value => value + 1);
    } catch { setMessage('No se pudieron guardar las metas. Revisa la conexión y la ficha.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-2 rounded-xl border border-line p-4" aria-label="Metas nutricionales">
    <h3 className="font-extrabold">Metas nutricionales</h3>
    {!current && <p role="status">Cargando metas…</p>}
    {current?.error && <p role="alert">No se pudieron consultar las metas. <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></p>}
    {current && !current.error && !current.goal && <p>No hay metas definidas para esta fecha.</p>}
    {current?.goal && <><p>Vigentes desde {current.goal.effective_on}.</p><div className="overflow-x-auto"><table className="w-full min-w-[400px] text-left">
      <thead><tr><th>Nutriente</th><th>Meta</th><th>Plan menos meta</th></tr></thead><tbody>{fields.map(([key,label,unit]) => {
        const target = current.goal![key]; const planned = summary?.nutrients[key].planned;
        const difference = typeof target === 'number' && planned && planned.count > 0 && planned.missing === 0 ? planned.known - target : null;
        return <tr key={key} className="border-t border-line"><th className="py-2">{label}</th><td>{target === null ? 'No definida' : `${target} ${unit}`}</td><td>{difference === null ? 'No disponible' : `${difference > 0 ? '+' : ''}${new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(difference)} ${unit}`}</td></tr>;
      })}</tbody></table></div><p className="text-xs text-mute">La diferencia requiere un plan con datos completos; no modifica la dieta.</p></>}
    {canEdit && <form onSubmit={save} className="space-y-2 rounded-lg bg-fill p-3"><h4 className="font-bold">Establecer nuevas metas</h4>
      <label className="block">Vigentes desde<input name="effective_on" type="date" min={today} defaultValue={date >= today ? date : today} required className={input} /></label>
      <div className="grid gap-2 sm:grid-cols-2">{fields.map(([key,label,unit,max]) => <label key={key}>{label} ({unit})<input name={key} type="number" min="0" max={max} step="0.1" className={input} /></label>)}</div>
      <p className="text-xs">Deja vacío lo que no desees establecer. Las metas son definidas por el profesional.</p>
      <button disabled={busy} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar metas'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
