"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, PersonStanding } from "lucide-react";
import { Panel } from "@/components/cecyfit/ui";
import { supabase } from "@/lib/supabase/clients";
import type { Patient } from "./types";
import { exercisePresets as presets, exerciseImageUrl as imageUrl } from './exercise-catalog';

type Exercise = { name: string; sets: string; repetitions: string; rest: string; instructions: string; image1?: string; image2?: string };
type Workout = { id: string; activity_date: string; title: string; exercises: Exercise[]; workout_logs: { status: string; exercise_index: number }[] };
const emptyExercise = (): Exercise => ({ name: "", sets: "", repetitions: "", rest: "", instructions: "" });
const input = "w-full rounded-lg border border-line px-2 py-2";

export function PatientWorkouts({ patient, tracking = false, date }: { patient: Patient; tracking?: boolean; date?: string }) {
  const [list, setList] = useState<Workout[]>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraDays, setExtraDays] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [workoutDate, setWorkoutDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([emptyExercise()]);
  useEffect(() => {
    let active = true;
    let query = supabase.from("patient_workouts").select("id,activity_date,title,exercises,workout_logs(status,exercise_index)")
      .eq("patient_id", patient.id).order("activity_date", { ascending: false }).limit(100);
    if (date) query = query.eq("activity_date", date);
    void Promise.resolve(query).then(({ data, error }) => {
      if (active) {
        if (error) setError("No se pudieron consultar las rutinas.");
        else setList(data as Workout[]);
      }
    }).catch(() => { if (active) setError("No se pudieron consultar las rutinas."); });
    return () => { active = false; };
  }, [patient.id, attempt, date]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (exercises.some((exercise) => !exercise.name.trim() || !exercise.sets.trim() || !exercise.repetitions.trim())) {
      setError("Completa el nombre, las series y las repeticiones de cada ejercicio.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const first = String(fields.get("date"));
      const rows = [0, ...extraDays].sort((a,b) => a-b).map(offset => {
        const day = new Date(`${first}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + offset);
        return { patient_id: patient.id, activity_date: day.toISOString().slice(0,10), title: String(fields.get("title")).trim(),
          exercises: exercises.map((exercise) => Object.fromEntries(Object.entries(exercise).map(([key, value]) => [key, (value ?? "").trim()]))) };
      });
      if (editing) {
        const { data, error } = await supabase.from('patient_workouts').update({ title: rows[0].title, exercises: rows[0].exercises })
          .eq('patient_id', patient.id).eq('id', editing).select('id').maybeSingle();
        if (error || !data) throw error ?? new Error('La rutina ya no se puede editar');
      } else {
        const { error } = await supabase.from("patient_workouts").insert(rows);
        if (error) throw error;
      }
      form.reset(); setTitle(""); setWorkoutDate(""); setEditing(null); setExercises([emptyExercise()]); setExtraDays([]); setMessage(editing ? 'Rutina actualizada.' : `Rutina asignada a ${1 + extraDays.length} fecha(s).`); setAttempt((value) => value + 1);
    } catch { setError("No se pudo guardar la rutina. Verifica la conexión; solo se pueden editar rutinas futuras sin avance registrado."); }
    finally { setSaving(false); }
  }

  return <Panel title={tracking ? "Actividad física" : "Editor de rutina"}>
    {error && <p role="alert">{error} <button className="underline" type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Actualizar</button></p>}
    {!list && !error && <p role="status">Cargando rutinas…</p>}
    {list?.length === 0 && <p>No hay rutinas asignadas{date ? " para este día" : ""}.</p>}
    {list?.map((workout) => <div key={workout.id} className="my-3 rounded-xl border border-line p-3 text-sm">
      <p className="font-bold">{workout.activity_date} · {workout.title}</p>
      <ul>{workout.exercises.map((item, index) => <li key={index}>{item.name} · {item.sets} series · {item.repetitions} repeticiones {item.rest && `· Descanso ${item.rest}`}</li>)}</ul>
      {!tracking && patient.status === "ACTIVE" && <button type="button" className="my-2 rounded-lg border border-line p-2 text-blue" onClick={() => { setEditing(null); setWorkoutDate(''); setExtraDays([]); setTitle(workout.title); setExercises(workout.exercises.map((exercise) => ({ ...exercise }))); setMessage("Rutina copiada al editor. Elige una fecha y asígnala."); }}>Usar como plantilla</button>}
      {!tracking && patient.status === 'ACTIVE' && workout.activity_date > new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date()) && !workout.workout_logs.length && <button type="button" className="my-2 ml-2 rounded-lg border border-line p-2 text-blue" onClick={() => { setEditing(workout.id); setWorkoutDate(workout.activity_date); setTitle(workout.title); setExercises(workout.exercises.map(exercise => ({ ...exercise }))); setExtraDays([]); setMessage('Editando esta rutina programada.'); }}>Editar rutina</button>}
      <p>{workout.workout_logs[0]?.status === "COMPLETED" ? "Completada" : workout.workout_logs[0]?.status === "PAUSED" ? "En pausa" : workout.workout_logs[0]?.status === "INTERRUPTED" ? "Interrumpida" : "Sin registro"}</p>
    </div>)}
    {!tracking && patient.status === "ACTIVE" && <form onSubmit={save} className="mt-4 space-y-3 rounded-xl bg-fill p-4 text-sm">
      <fieldset disabled={saving} className="space-y-3">
        <label className="block">Fecha<input name="date" type="date" required className={input} value={workoutDate} onChange={event => setWorkoutDate(event.target.value)} readOnly={Boolean(editing)} /></label>
        {!editing && <fieldset><legend className="font-bold">Repetir en los siguientes días (opcional)</legend><div className="flex flex-wrap gap-2">{[1,2,3,4,5,6].map(day => <label key={day} className="rounded-lg border border-line bg-white p-2"><input type="checkbox" checked={extraDays.includes(day)} onChange={event => { const checked = event.target.checked; setExtraDays(current => checked ? [...current,day] : current.filter(value => value !== day)); }} /> {day === 1 ? "+1 día" : `+${day} días`}</label>)}</div><p>Se creará una actividad independiente para cada fecha elegida.</p></fieldset>}
        <label className="block">Nombre de la rutina<input name="title" maxLength={120} required className={input} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        {exercises.map((exercise, index) => <div key={index} className="grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-2">
          <label>Ejercicio<select required className={input} value={exercise.name} onChange={event => { const name=event.target.value; const preset=presets.find(item => item[0] === name); setExercises(current => current.map((item,i) => i === index ? { ...item, name, image1: preset ? imageUrl(preset[1],0) : "", image2: preset ? imageUrl(preset[1],1) : "" } : item)); }}><option value="">Seleccionar ejercicio</option>{exercise.name && !presets.some(item=>item[0]===exercise.name) && <option>{exercise.name}</option>}{presets.map(([name]) => <option key={name}>{name}</option>)}</select></label>
          {(["sets", "repetitions", "rest"] as const).map(key => { const options = key === "sets" ? Array.from({length:10},(_,i)=>String(i+1)) : key === "repetitions" ? Array.from({length:30},(_,i)=>String(i+1)) : ["15 s","30 s","45 s","60 s","90 s","120 s","180 s"]; return <label key={key}>{{sets:"Series",repetitions:"Repeticiones",rest:"Descanso"}[key]}<select required className={input} value={exercise[key]} onChange={event => {const value=event.target.value;setExercises(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item));}}><option value="">Seleccionar</option>{exercise[key] && !options.includes(exercise[key]) && <option>{exercise[key]}</option>}{options.map(value=><option key={value}>{value}</option>)}</select></label>; })}
          <label>Indicaciones<input value={exercise.instructions} maxLength={250} className={input} onChange={event => {const value=event.target.value;setExercises(current=>current.map((item,i)=>i===index?{...item,instructions:value}:item));}} /></label>
          {exercise.image1 && <p className="text-xs">Incluye imágenes de inicio y final del movimiento.</p>}
          {exercises.length > 1 && <button type="button" className="text-left text-red-700" onClick={() => setExercises((current) => current.filter((_, i) => i !== index))}>Quitar ejercicio</button>}
        </div>)}
        {exercises.length < 30 && <button type="button" className="rounded-lg border border-line p-2" onClick={() => setExercises((current) => [...current, emptyExercise()])}><span className="inline-flex items-center gap-1"><Plus size={16}/><PersonStanding size={16}/> Agregar ejercicio</span></button>}
        <button type="submit" className="ml-2 rounded-lg bg-blue p-2 font-bold text-white">{saving ? "Guardando…" : editing ? 'Guardar cambios' : "Asignar rutina"}</button>
        {editing && <button type="button" className="ml-2 rounded-lg border border-line p-2" onClick={() => { setEditing(null); setWorkoutDate(''); setTitle(''); setExercises([emptyExercise()]); setMessage(''); }}>Cancelar edición</button>}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>}
  </Panel>;
}
