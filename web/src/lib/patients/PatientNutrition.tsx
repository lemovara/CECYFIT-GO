"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Btn, Panel } from "@/components/cecyfit/ui";
import { supabase } from "@/lib/supabase/clients";
import type { Patient } from "./types";
import { CatalogMealPicker } from "./CatalogMealPicker";
import { mealSuggestions } from "@/lib/nutrition/meal-suggestions";
import { summarizeDay } from "@/lib/nutrition/daily-summary";
import { PatientHydrationSummary } from "./PatientHydrationSummary";
import { PatientWorkouts } from "./PatientWorkouts";
import { PatientNutritionGoals } from "./PatientNutritionGoals";

type Meal = {
  id: string;
  meal_date: string;
  revision: number;
  scheduled_time: string;
  name: string;
  ingredients: string;
  notes: string;
  kcal: number | null;
  nutrition_snapshot: unknown;
};

type MealLog = { meal_id: string; status: "CONSUMED" | "SKIPPED"; logged_at: string };
type ExtraMealLog = { id: string; patient_user_id: string; name: string; portion: string; kcal: number | null; created_at: string; nutrition_snapshot: { kind?: string; allergens?: string[]; traces?: string[]; labels?: string[]; source_name?: string | null; consumed_time?: string; time_zone?: string; protein?: number | null; carbs?: number | null; fat?: number | null; fiber?: number | null } | null };
type PlanView = {
  start: string;
  logDate: string;
  attempt: number;
  meals: Meal[];
  logs: MealLog[];
  extraMeals: ExtraMealLog[] | null;
  error?: string;
};

function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date());
}

function shiftDate(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function mondayOf(value: string) {
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  return shiftDate(value, -((weekday + 6) % 7));
}

const weekdayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const loggedTimeFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" });

function saveMessage(code: string, fallback: string) {
  if (code === "23505") return "Ya hay una comida en uno de esos horarios. No se guardaron los cambios.";
  if (code === "22023" || code === "23514") return "Revisa la fecha, el horario y los datos de la comida.";
  if (code === "42501") return "Solo puedes modificar el menú de tus fichas activas.";
  if (code === "P0002") return "La comida cambió o ya no se puede editar. Actualiza el menú antes de volver a intentarlo.";
  return fallback;
}

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-ink";
const nutrient = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${value} g` : "no disponible";
const numeric = (value: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value);
const total = (value: { known: number; missing: number; count: number } | null, unit: string) => {
  if (value === null) return "No disponible";
  if (value.count > 0 && value.missing === value.count) return `Sin datos (${value.missing})`;
  return `${numeric(value.known)} ${unit}${value.missing ? ` · parcial (${value.missing} sin datos)` : ""}`;
};

export function PatientNutrition({ patient, tracking }: { patient: Patient; tracking: boolean }) {
  const [date, setDate] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [plan, setPlan] = useState<PlanView>();
  const [editing, setEditing] = useState<Meal | null>(null);
  const [copyFrom, setCopyFrom] = useState("");
  const [copyMeal, setCopyMeal] = useState<Meal | null>(null);
  const [copyTarget, setCopyTarget] = useState("");
  const [copyTime, setCopyTime] = useState("");
  const [removing, setRemoving] = useState<Meal | null>(null);
  const [moving, setMoving] = useState<Meal | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const start = date ? mondayOf(date) : "";
  const logDate = tracking ? date : "";
  const current = plan?.start === start && plan.logDate === logDate && plan.attempt === attempt ? plan : undefined;
  const mealsForDate = current?.meals.filter((meal) => meal.meal_date === date) ?? [];
  const summary = current && !current.error ? summarizeDay(mealsForDate, current.logs, tracking ? current.extraMeals : null) : null;
  const currentDate = today();
  const canAssign = !tracking && patient.status === "ACTIVE" && date >= currentDate;
  const canEdit = canAssign && date > currentDate;

  useEffect(() => {
    if (!start) return;
    let active = true;
    async function loadExtraMeals() {
      if (!logDate) return [];
      try {
        const { data, error } = await supabase.from("extra_meal_logs")
          .select("id,patient_user_id,name,portion,kcal,created_at,nutrition_snapshot")
          .eq("patient_id", patient.id).eq("meal_date", logDate).order("created_at", { ascending: false });
        return error ? null : data as ExtraMealLog[];
      } catch {
        return null;
      }
    }
    async function load() {
      const extraMealsRequest = loadExtraMeals();
      try {
        const meals = await supabase.from("patient_meals")
          .select("id,meal_date,revision,scheduled_time,name,ingredients,notes,kcal,nutrition_snapshot")
          .eq("patient_id", patient.id).gte("meal_date", start)
          .lt("meal_date", shiftDate(start, 7)).order("meal_date").order("scheduled_time");
        if (meals.error) throw meals.error;
        let logs: MealLog[] = [];
        const trackedMeals = logDate ? meals.data.filter((meal) => meal.meal_date === logDate) : [];
        if (trackedMeals.length) {
          const result = await supabase.from("meal_logs").select("meal_id,status,logged_at")
            .in("meal_id", trackedMeals.map((meal) => meal.id)).order("logged_at", { ascending: false });
          if (result.error) throw result.error;
          logs = result.data as MealLog[];
        }
        const extraMeals = await extraMealsRequest;
        if (active) setPlan({ start, logDate, attempt, meals: meals.data as Meal[], logs, extraMeals });
      } catch {
        const extraMeals = await extraMealsRequest;
        if (active) setPlan({ start, logDate, attempt, meals: [], logs: [], extraMeals, error: "No se pudo cargar el menú de esta semana." });
      }
    }
    void load();
    return () => { active = false; };
  }, [patient.id, start, attempt, logDate]);

  function selectDay(next: string) {
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "");
    setEditing(null);
    setCopyFrom("");
    setCopyMeal(null);
    setRemoving(null);
    setMoving(null);
    setMessage("");
  }

  async function runSave(action: () => Promise<string>) {
    setSaving(true);
    setSaveError(false);
    setMessage("");
    try {
      setMessage(await action());
      setAttempt((previous) => previous + 1);
    } catch (error) {
      setSaveError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el menú. Vuelve a intentarlo.");
    } finally {
      setSaving(false);
    }
  }

  async function assignMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAssign || saving || (editing && !canEdit)) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    if (!name) {
      setSaveError(true);
      setMessage("Escribe el nombre del platillo.");
      return;
    }
    await runSave(async () => {
      const calories = String(values.get("kcal") ?? "");
      const fields = {
        p_patient_id: patient.id,
        p_scheduled_time: String(values.get("time") ?? ""),
        p_name: name,
        p_ingredients: String(values.get("ingredients") ?? ""),
        p_notes: String(values.get("notes") ?? ""),
        p_kcal: calories ? Number(calories) : null,
      };
      const { error } = editing
        ? await supabase.rpc("update_patient_meal", { ...fields, p_meal_id: editing.id, p_revision: editing.revision })
        : await supabase.rpc("assign_patient_meal", { ...fields, p_meal_date: date });
      if (error) {
        throw new Error(saveMessage(error.code, "No se pudo guardar la comida. Vuelve a intentarlo."));
      }
      form.reset();
      setEditing(null);
      return editing ? "Cambios publicados." : "Comida publicada.";
    });
  }

  async function copyDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving || !copyFrom || copyFrom === date) return;
    await runSave(async () => {
      const { data, error } = await supabase.rpc("copy_patient_meals", {
        p_patient_id: patient.id, p_source_date: copyFrom, p_target_date: date,
      });
      if (error) throw new Error(saveMessage(error.code, "No se pudo copiar el día."));
      if (data === 0) return "El día de origen no tiene comidas.";
      setCopyFrom("");
      return data === 1 ? "Se copió y publicó una comida." : `Se copiaron y publicaron ${data} comidas.`;
    });
  }

  async function duplicateMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!copyMeal || saving || patient.status !== "ACTIVE" || copyTarget <= today() || !copyTime) return;
    await runSave(async () => {
      const { data: source, error: readError } = await supabase.from("patient_meals")
        .select("scheduled_time,name,ingredients,notes,kcal,recipe_id,nutrition_snapshot,photo_url")
        .eq("patient_id", patient.id).eq("id", copyMeal.id).eq("revision", copyMeal.revision).maybeSingle();
      if (readError || !source) throw new Error("La comida cambió o dejó de estar disponible. Actualiza el menú antes de copiarla.");
      const { error } = await supabase.from("patient_meals").insert({ ...source, patient_id: patient.id,
        meal_date: copyTarget, scheduled_time: copyTime });
      if (error) throw new Error(saveMessage(error.code, "No se pudo copiar la comida. Actualiza el menú antes de reintentar."));
      setCopyMeal(null);
      return "Comida copiada y publicada. Se conservaron sus ingredientes y datos nutricionales.";
    });
  }

  async function removeMeal(meal: Meal) {
    if (!canEdit || saving) return;
    await runSave(async () => {
      const { error } = await supabase.rpc("remove_future_meal", {
        p_patient_id: patient.id, p_meal_id: meal.id, p_revision: meal.revision,
      });
      if (error) throw new Error(saveMessage(error.code, "No se pudo retirar la comida. Actualiza el menú antes de reintentar."));
      setRemoving(null);
      if (editing?.id === meal.id) setEditing(null);
      if (copyMeal?.id === meal.id) setCopyMeal(null);
      if (moving?.id === meal.id) setMoving(null);
      return "Comida retirada del plan.";
    });
  }

  async function moveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moving || !canEdit || saving || moveDate <= today() || !moveTime ||
      (moveDate === moving.meal_date && moveTime === moving.scheduled_time.slice(0, 5))) return;
    await runSave(async () => {
      const { error } = await supabase.rpc("reschedule_future_meal", {
        p_patient_id: patient.id, p_meal_id: moving.id, p_revision: moving.revision, p_day: moveDate, p_time: moveTime,
      });
      if (error) throw new Error(saveMessage(error.code, "No se pudo mover la comida. Actualiza el menú antes de reintentar."));
      if (editing?.id === moving.id) setEditing(null);
      if (copyMeal?.id === moving.id) setCopyMeal(null);
      setMoving(null);
      return "Comida movida y publicada en el nuevo horario.";
    });
  }

  return (
    <Panel title={tracking ? "Seguimiento nutricional" : "Plan nutricional"} right={
      <Btn variant="secondary" onClick={() => setAttempt((previous) => previous + 1)}>Actualizar</Btn>
    }>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block max-w-52 font-bold">Fecha
            <input type="date" className={input} value={date} disabled={saving} onChange={(event) => selectDay(event.target.value)} />
          </label>
          <fieldset disabled={saving} className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => selectDay(shiftDate(date || currentDate, -7))}>Semana anterior</button>
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => selectDay(currentDate)}>Hoy</button>
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => selectDay(shiftDate(date || currentDate, 7))}>Semana siguiente</button>
          </fieldset>
        </div>
        {start && <fieldset disabled={saving} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <legend className="sr-only">Días de la semana</legend>
          {Array.from({ length: 7 }, (_, index) => {
            const day = shiftDate(start, index);
            const count = current && !current.error ? current.meals.filter((meal) => meal.meal_date === day).length : undefined;
            return <button key={day} type="button" aria-pressed={date === day} onClick={() => selectDay(day)}
              className={`rounded-lg border px-3 py-2 text-left ${date === day ? "border-blue bg-blue text-white" : "border-line bg-white"}`}>
              <span className="block font-bold">{weekdayFormat.format(new Date(`${day}T12:00:00Z`))}</span>
              {count !== undefined && <span className="text-xs">{count === 1 ? "1 comida" : `${count} comidas`}</span>}
            </button>;
          })}
        </fieldset>}
        {date && <h2 className="font-extrabold">Menú del {dayFormat.format(new Date(`${date}T12:00:00Z`))}</h2>}
        {date && !current && <p role="status">Cargando menú…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {summary && <section className="space-y-2 rounded-xl border border-line p-4" aria-label="Resumen nutricional diario">
          <h3 className="font-extrabold">Resumen nutricional diario</h3>
          {summary.planned.count === 0 && <p>Sin comidas planificadas para esta fecha.</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
            <thead><tr><th>Nutriente</th><th>Plan</th>{tracking && <><th>Consumido del plan</th><th>Adicional</th><th>Total registrado</th><th>Diferencia</th></>}</tr></thead>
            <tbody>{([
              ["Energía", "kcal", "kcal"], ["Proteína", "protein", "g"], ["Carbohidratos", "carbs", "g"],
              ["Grasas", "fat", "g"], ["Fibra", "fiber", "g"],
            ] as const).map(([label, key, unit]) => {
              const item = summary.nutrients[key];
              return <tr key={key} className="border-t border-line"><th className="py-2 pr-3">{label}</th><td className="p-2">{total(item.planned, unit)}</td>
                {tracking && <><td className="p-2">{total(item.reportedPlan, unit)}</td><td className="p-2">{total(item.extras, unit)}</td>
                  <td className="p-2">{total(item.actual, unit)}</td><td className="p-2">{item.difference === null ? "No disponible" : `${item.difference > 0 ? "+" : ""}${numeric(item.difference)} ${unit}`}</td></>}
              </tr>;
            })}</tbody>
          </table></div>
          {tracking && <>
            {summary.unregistered > 0 && <p>Comidas del plan sin registro: {summary.unregistered}. El total registrado puede estar incompleto.</p>}
            {summary.extras === null && <p>No se pudieron consultar los alimentos adicionales.</p>}
            <p className="text-xs text-mute">Estimaciones basadas en las instantáneas del plan y los registros declarados. Las comidas históricas y manuales pueden no incluir macros. La diferencia solo se muestra con datos completos y todas las comidas registradas; no modifica la dieta.</p>
          </>}
        </section>}
        {date && <PatientNutritionGoals key={`${patient.id}:${date}`} patientId={patient.id} date={date} today={currentDate} canEdit={patient.status === 'ACTIVE'} summary={summary} />}
        {current && !current.error && mealsForDate.length === 0 && <p>Aún no hay comidas asignadas para esta fecha.</p>}
        {mealsForDate.map((meal) => {
          const log = current?.logs.find((item) => item.meal_id === meal.id);
          return <div key={meal.id} className="rounded-xl border border-line p-3">
            <p><b>{meal.scheduled_time.slice(0, 5)} · {meal.name}</b>{meal.kcal !== null && ` · ${meal.kcal} kcal`}</p>
            {meal.ingredients && <p className="whitespace-pre-wrap">{meal.ingredients}</p>}
            {meal.notes && <p className="whitespace-pre-wrap text-mute">{meal.notes}</p>}
            {tracking && <p className="mt-2 font-semibold">{log ? log.status === "CONSUMED" ? "Consumida" : "No consumida" : "Sin registro"}
              {log && ` · ${new Date(log.logged_at).toLocaleString("es-MX")}`}</p>}
            {canEdit && <button type="button" disabled={saving} onClick={() => {
              setEditing(meal);
              setMessage("");
            }} className="mt-2 font-bold text-blue" aria-label={`Editar ${meal.name}`}>Editar</button>}
            {!tracking && patient.status === "ACTIVE" && <button type="button" disabled={saving} onClick={() => {
              setCopyMeal(meal); setCopyTarget(shiftDate(currentDate, 1)); setCopyTime(meal.scheduled_time.slice(0, 5)); setMessage("");
            }} className="ml-4 mt-2 font-bold text-blue disabled:opacity-60" aria-label={`Copiar ${meal.name}`}>Copiar comida</button>}
            {canEdit && <button type="button" disabled={saving} onClick={() => {
              setMoving(meal); setMoveDate(meal.meal_date); setMoveTime(meal.scheduled_time.slice(0, 5)); setMessage("");
            }} className="ml-4 mt-2 font-bold text-blue disabled:opacity-60" aria-label={`Mover ${meal.name}`}>Mover</button>}
            {canEdit && (removing?.id === meal.id ? <div className="mt-2 flex flex-wrap items-center gap-3" role="group" aria-label={`Confirmar retiro de ${meal.name}`}>
              <span>¿Retirar esta comida del plan?</span>
              <button type="button" disabled={saving} onClick={() => void removeMeal(meal)} className="font-bold text-red-700 disabled:opacity-60">Confirmar retiro</button>
              <button type="button" disabled={saving} onClick={() => setRemoving(null)} className="font-bold text-blue">Cancelar</button>
            </div> : <button type="button" disabled={saving} onClick={() => { setRemoving(meal); setMessage(""); }}
              className="ml-4 mt-2 font-bold text-red-700 disabled:opacity-60" aria-label={`Retirar ${meal.name}`}>Retirar</button>)}
          </div>;
        })}
        {moving && canEdit && <form onSubmit={moveMeal} className="space-y-2 rounded-xl border border-line p-4">
          <h3 className="font-extrabold">Mover {moving.name}</h3>
          <p>La comida cambiará de fecha u horario conservando su receta e información nutricional. Elige un horario libre en una fecha futura.</p>
          <fieldset disabled={saving} className="flex flex-wrap items-end gap-3">
            <label>Fecha de destino<input type="date" required min={shiftDate(currentDate, 1)} value={moveDate} onChange={event => setMoveDate(event.target.value)} className={input} /></label>
            <label>Horario<input type="time" required value={moveTime} onChange={event => setMoveTime(event.target.value)} className={input} /></label>
            <button type="submit" disabled={moveDate === moving.meal_date && moveTime === moving.scheduled_time.slice(0, 5)} className="rounded-xl bg-blue px-4 py-2 font-bold text-white disabled:opacity-60">{saving ? "Moviendo…" : "Mover y publicar"}</button>
            <button type="button" onClick={() => setMoving(null)} className="px-3 py-2 font-bold">Cancelar</button>
          </fieldset>
        </form>}
        {copyMeal && !tracking && <form onSubmit={duplicateMeal} className="space-y-2 rounded-xl border border-line p-4">
          <h3 className="font-extrabold">Copiar {copyMeal.name}</h3>
          <p>La copia se publicará para este paciente y conservará la receta, la imagen y sus cantidades. Elige un día futuro y un horario libre.</p>
          <fieldset disabled={saving} className="flex flex-wrap items-end gap-3">
            <label>Fecha de destino<input type="date" required min={shiftDate(currentDate, 1)} value={copyTarget} onChange={event => setCopyTarget(event.target.value)} className={input} /></label>
            <label>Horario<input type="time" required value={copyTime} onChange={event => setCopyTime(event.target.value)} className={input} /></label>
            <button type="submit" className="rounded-xl bg-blue px-4 py-2 font-bold text-white">{saving ? "Copiando…" : "Copiar y publicar"}</button>
            <button type="button" onClick={() => setCopyMeal(null)} className="px-3 py-2 font-bold">Cancelar</button>
          </fieldset>
        </form>}
        {tracking && date && <PatientHydrationSummary key={`${date}:${attempt}`} patientId={patient.id} date={date} />}
        {tracking && date && <PatientWorkouts key={`${date}:${attempt}`} patient={patient} tracking date={date} />}
        {tracking && current && <section className="space-y-2 rounded-xl border border-line p-4">
          <h3 className="font-extrabold">Comidas fuera del plan</h3>
          {current.extraMeals === null && <p role="alert">No se pudieron consultar las comidas fuera del plan. Pulsa Actualizar para reintentar.</p>}
          {current.extraMeals?.length === 0 && <p>El paciente aún no registró comidas fuera del plan para este día.</p>}
          {current.extraMeals?.map((entry) => <div key={`${entry.patient_user_id}:${entry.id}`} className="rounded-lg bg-fill p-3">
            <p><b>{entry.name}</b> · {entry.portion}{entry.kcal !== null && ` · ${entry.kcal} kcal indicadas`}</p>
            {entry.nutrition_snapshot ? <p className="text-mute">Estimación declarada · proteína {nutrient(entry.nutrition_snapshot.protein)} · carbohidratos {nutrient(entry.nutrition_snapshot.carbs)} · grasas {nutrient(entry.nutrition_snapshot.fat)} · fibra {nutrient(entry.nutrition_snapshot.fiber)} · {typeof entry.nutrition_snapshot.source_name === "string" ? entry.nutrition_snapshot.source_name : "catálogo CECYFIT"}</p> : <p className="text-mute">Registro manual o anterior; datos nutricionales incompletos.</p>}
            {entry.nutrition_snapshot?.kind === 'product' && <p className="text-mute">Alérgenos reportados: {Array.isArray(entry.nutrition_snapshot.allergens) && entry.nutrition_snapshot.allergens.length ? entry.nutrition_snapshot.allergens.join(', ') : 'sin información disponible'} · Trazas: {Array.isArray(entry.nutrition_snapshot.traces) && entry.nutrition_snapshot.traces.length ? entry.nutrition_snapshot.traces.join(', ') : 'sin información disponible'}{Array.isArray(entry.nutrition_snapshot.labels) && entry.nutrition_snapshot.labels.length > 0 && ` · Etiquetas: ${entry.nutrition_snapshot.labels.join(', ')}`}</p>}
            {typeof entry.nutrition_snapshot?.consumed_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.nutrition_snapshot.consumed_time) && <p className="text-mute">Hora de consumo declarada: {entry.nutrition_snapshot.consumed_time}{entry.nutrition_snapshot.time_zone === "America/Mexico_City" && " · Ciudad de México"}</p>}
            <p className="text-mute">Recibida en el servidor el {loggedTimeFormat.format(new Date(entry.created_at))}</p>
          </div>)}
        </section>}
        {canEdit && <form onSubmit={copyDay} className="space-y-2 rounded-xl border border-line p-4">
          <h3 className="font-extrabold">Copiar comidas a este día</h3>
          <p>Se publicarán las comidas del día de origen. Si algún horario coincide, la copia se cancela completa.</p>
          <fieldset disabled={saving} className="flex flex-wrap items-end gap-3">
            <label>Día de origen<input type="date" required className={input} value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)} /></label>
            <button type="submit" disabled={!copyFrom || copyFrom === date} className="rounded-xl border border-line px-4 py-2 font-bold text-blue disabled:opacity-60">Copiar y publicar</button>
          </fieldset>
        </form>}
        {canAssign && !editing && <CatalogMealPicker key={`catalog:${date}`} patientId={patient.id} date={date} onAssigned={() => setAttempt((value) => value + 1)} />}
        {canAssign && <form key={editing ? `edit:${editing.id}:${editing.revision}` : `manual:${date}`} onSubmit={assignMeal} className="space-y-3 rounded-xl bg-fill p-4">
          <h3 className="font-extrabold">{editing ? "Editar comida" : "Asignar una comida"}</h3>
          <fieldset disabled={saving || !date} className="grid grid-cols-2 gap-3">
            <label className="col-span-2">Platillo<input required maxLength={120} name="name" className={input} defaultValue={editing?.name} list="meal-suggestions" /></label>
            <datalist id="meal-suggestions">{mealSuggestions.map(name => <option key={name} value={name} />)}</datalist>
            {!editing && <p className="col-span-2 text-xs">Escribe para elegir entre nombres sugeridos. Completa los ingredientes, las cantidades y las indicaciones antes de publicar; los nombres no incluyen información nutricional.</p>}
            <label>Horario<input required type="time" name="time" className={input} defaultValue={editing?.scheduled_time.slice(0, 5)} /></label>
            <label>Calorías (opcional)<input type="number" min="0" max="10000" name="kcal" className={input} defaultValue={editing?.kcal ?? ""} /></label>
            <label className="col-span-2">Ingredientes y porciones<textarea name="ingredients" maxLength={3000} className={input} rows={3} defaultValue={editing?.ingredients} /></label>
            <label className="col-span-2">Indicaciones<textarea name="notes" maxLength={3000} className={input} rows={2} defaultValue={editing?.notes} /></label>
            <button type="submit" className="justify-self-start rounded-xl bg-blue px-4 py-2 font-bold text-white disabled:opacity-60">
              {saving ? "Guardando…" : editing ? "Publicar cambios" : "Publicar comida"}
            </button>
            {editing && <button type="button" className="justify-self-start px-3 py-2 font-bold" onClick={() => setEditing(null)}>Cancelar edición</button>}
          </fieldset>
        </form>}
        {message && <p role={saveError ? "alert" : "status"}>{message}</p>}
      </div>
    </Panel>
  );
}
