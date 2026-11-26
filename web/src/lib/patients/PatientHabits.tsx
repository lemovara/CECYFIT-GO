"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { Panel } from '@/components/cecyfit/ui';
import { supabase } from '@/lib/supabase/clients';
import type { Patient } from './types';

type Habit = { id: string; title: string; description: string; goal: string; weekdays: number[]; active: boolean;
  habit_logs: { log_date: string; completed: boolean }[] };
const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const input = 'w-full rounded-lg border border-line p-2';

export function PatientHabits({ patient }: { patient: Patient }) {
  const [habits, setHabits] = useState<Habit[]>();
  const [attempt, setAttempt] = useState(0);
  const [weekdays, setWeekdays] = useState<number[]>([1,2,3,4,5,6,7]);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from('patient_habits').select('id,title,description,goal,weekdays,active,habit_logs(log_date,completed)')
      .eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (active) { if (error) setMessage('No se pudieron consultar los hábitos.'); else setHabits(data as Habit[]); } });
    return () => { active = false; };
  }, [patient.id, attempt]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!weekdays.length || !title.trim()) { setMessage('Escribe un nombre y selecciona al menos un día.'); return; }
    setBusy(true); setMessage('');
    try {
      const sorted = [...weekdays].sort((a,b) => a-b);
      const { error } = editing
        ? await supabase.rpc('revise_patient_habit', { p_patient_id: patient.id, p_habit_id: editing,
          p_title: title.trim(), p_description: description.trim(), p_goal: goal.trim(), p_weekdays: sorted })
        : await supabase.from('patient_habits').insert({ patient_id: patient.id,
          title: title.trim(), description: description.trim(), goal: goal.trim(), weekdays: sorted });
      if (error) throw error;
      setTitle(''); setDescription(''); setGoal(''); setWeekdays([1,2,3,4,5,6,7]); setEditing(null);
      setMessage(editing ? 'Hábito actualizado. Los registros anteriores se conservaron.' : 'Hábito asignado.'); setAttempt(value => value + 1);
    } catch { setMessage('No se pudo guardar el hábito. Revisa la conexión y los datos.'); }
    finally { setBusy(false); }
  }
  async function deactivate(id: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.from('patient_habits').update({ active: false }).eq('id', id).eq('patient_id', patient.id).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('Hábito no disponible');
      setMessage('Hábito desactivado. Se conserva su historial.'); setAttempt(value => value + 1);
    } catch { setMessage('No se pudo desactivar el hábito.'); }
    finally { setBusy(false); }
  }
  return <Panel title="Hábitos del paciente">
    {message && <p role="status">{message}</p>}
    {!habits && !message && <p>Cargando hábitos…</p>}
    {habits?.length === 0 && <p>No hay hábitos asignados.</p>}
    {habits?.map(habit => <div key={habit.id} className="my-3 rounded-lg border border-line p-3">
      <p className="font-bold">{habit.title} · {habit.active ? 'Activo' : 'Inactivo'}</p>
      <p>{habit.description}</p><p>{habit.goal && `Meta: ${habit.goal} · `}{habit.weekdays.map(day => days[day-1]).join(', ')}</p>
      <p className="text-sm">Últimos registros: {habit.habit_logs.length ? [...habit.habit_logs].sort((a,b) => b.log_date.localeCompare(a.log_date)).slice(0, 7).map(log => `${log.log_date}: ${log.completed ? 'cumplido' : 'no cumplido'}`).join(' · ') : 'Sin registros'}</p>
      {habit.active && patient.status === 'ACTIVE' && <div className="flex gap-3">
        <button type="button" disabled={busy} className="text-blue underline" onClick={() => { setEditing(habit.id); setTitle(habit.title); setDescription(habit.description); setGoal(habit.goal); setWeekdays([...habit.weekdays]); setMessage('Edita el hábito en el formulario. Los registros anteriores se conservarán.'); }}>Editar hábito</button>
        <button type="button" disabled={busy} className="text-blue underline" onClick={() => void deactivate(habit.id)}>Desactivar hábito</button>
      </div>}
    </div>)}
    {patient.status === 'ACTIVE' && <form onSubmit={create} className="space-y-2 rounded-lg bg-fill p-3">
      <h4 className="font-bold">{editing ? 'Editar hábito' : 'Asignar hábito'}</h4>
      {editing && <p className="text-sm">Se guardará una versión nueva; el historial anterior seguirá visible.</p>}
      <label className="block">Nombre<input className={input} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required /></label>
      <label className="block">Descripción<input className={input} value={description} onChange={event => setDescription(event.target.value)} maxLength={500} /></label>
      <label className="block">Meta<input className={input} value={goal} onChange={event => setGoal(event.target.value)} maxLength={120} /></label>
      <fieldset><legend>Días programados</legend><div className="flex flex-wrap gap-2">{days.map((day, index) => <label key={day}><input type="checkbox" checked={weekdays.includes(index+1)} onChange={event => { const checked = event.target.checked; setWeekdays(current => checked ? [...current,index+1] : current.filter(value => value !== index+1)); }} /> {day}</label>)}</div></fieldset>
      <button disabled={busy} className="rounded-lg bg-blue p-2 font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Asignar hábito'}</button>
      {editing && <button type="button" disabled={busy} className="ml-2 text-blue underline" onClick={() => { setEditing(null); setTitle(''); setDescription(''); setGoal(''); setWeekdays([1,2,3,4,5,6,7]); setMessage(''); }}>Cancelar edición</button>}
    </form>}
  </Panel>;
}
