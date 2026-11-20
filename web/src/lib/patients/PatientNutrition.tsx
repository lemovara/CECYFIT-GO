"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Btn, Panel } from "@/components/cecyfit/ui";
import { supabase } from "@/lib/supabase/clients";
import type { Patient } from "./types";

type Meal = {
  id: string;
  scheduled_time: string;
  name: string;
  ingredients: string;
  notes: string;
  kcal: number | null;
};

type MealLog = { meal_id: string; status: "CONSUMED" | "SKIPPED"; logged_at: string };
type DailyPlan = { date: string; attempt: number; meals: Meal[]; logs: MealLog[]; error?: string };

function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date());
}

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-ink";

export function PatientNutrition({ patient, tracking }: { patient: Patient; tracking: boolean }) {
  const [date, setDate] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const current = dailyPlan?.date === date && dailyPlan.attempt === attempt ? dailyPlan : undefined;

  useEffect(() => {
    if (!date) return;
    let active = true;
    async function load() {
      try {
        const meals = await supabase.from("patient_meals")
          .select("id,scheduled_time,name,ingredients,notes,kcal")
          .eq("patient_id", patient.id).eq("meal_date", date).order("scheduled_time");
        if (meals.error) throw meals.error;
        let logs: MealLog[] = [];
        if (tracking && meals.data.length) {
          const result = await supabase.from("meal_logs").select("meal_id,status,logged_at")
            .in("meal_id", meals.data.map((meal) => meal.id)).order("logged_at", { ascending: false });
          if (result.error) throw result.error;
          logs = result.data as MealLog[];
        }
        if (active) setDailyPlan({ date, attempt, meals: meals.data as Meal[], logs });
      } catch {
        if (active) setDailyPlan({ date, attempt, meals: [], logs: [], error: "No se pudo cargar el plan de este día." });
      }
    }
    void load();
    return () => { active = false; };
  }, [patient.id, date, attempt, tracking]);

  async function assignMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    if (!name) {
      setMessage("Escribe el nombre del platillo.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const calories = String(values.get("kcal") ?? "");
      const { error } = await supabase.from("patient_meals").insert({
        patient_id: patient.id,
        meal_date: date,
        scheduled_time: values.get("time"),
        name,
        ingredients: String(values.get("ingredients") ?? "").trim(),
        notes: String(values.get("notes") ?? "").trim(),
        kcal: calories ? Number(calories) : null,
      });
      if (error) setMessage("No se pudo asignar la comida. Comprueba el horario y el estado de la ficha.");
      else {
        form.reset();
        setMessage("Comida asignada.");
        setAttempt((previous) => previous + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={tracking ? "Seguimiento nutricional" : "Plan nutricional"} right={
      <Btn variant="secondary" onClick={() => setAttempt((previous) => previous + 1)}>Actualizar</Btn>
    }>
      <div className="space-y-4 text-sm">
        <label className="block max-w-52 font-bold">Fecha
          <input type="date" className={input} value={date} disabled={saving} onChange={(event) => {
            setDate(event.target.value);
            setMessage("");
          }} />
        </label>
        {date && !current && <p role="status">Cargando menú…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {current && !current.error && current.meals.length === 0 && <p>Aún no hay comidas asignadas para esta fecha.</p>}
        {current?.meals.map((meal) => {
          const log = current.logs.find((item) => item.meal_id === meal.id);
          return <div key={meal.id} className="rounded-xl border border-line p-3">
            <p><b>{meal.scheduled_time.slice(0, 5)} · {meal.name}</b>{meal.kcal !== null && ` · ${meal.kcal} kcal`}</p>
            {meal.ingredients && <p className="whitespace-pre-wrap">{meal.ingredients}</p>}
            {meal.notes && <p className="whitespace-pre-wrap text-mute">{meal.notes}</p>}
            {tracking && <p className="mt-2 font-semibold">{log ? log.status === "CONSUMED" ? "Consumida" : "No consumida" : "Sin registro"}
              {log && ` · ${new Date(log.logged_at).toLocaleString("es-MX")}`}</p>}
          </div>;
        })}
        {!tracking && patient.status === "ACTIVE" && <form onSubmit={assignMeal} className="space-y-3 rounded-xl bg-fill p-4">
          <h2 className="font-extrabold">Asignar una comida</h2>
          <fieldset disabled={saving || !date} className="grid grid-cols-2 gap-3">
            <label className="col-span-2">Platillo<input required maxLength={120} name="name" className={input} /></label>
            <label>Horario<input required type="time" name="time" className={input} /></label>
            <label>Calorías (opcional)<input type="number" min="0" max="10000" name="kcal" className={input} /></label>
            <label className="col-span-2">Ingredientes y porciones<textarea name="ingredients" maxLength={3000} className={input} rows={3} /></label>
            <label className="col-span-2">Indicaciones<textarea name="notes" maxLength={3000} className={input} rows={2} /></label>
            <button type="submit" className="justify-self-start rounded-xl bg-blue px-4 py-2 font-bold text-white disabled:opacity-60">
              {saving ? "Guardando…" : "Asignar comida"}
            </button>
          </fieldset>
          {message && <p role="status">{message}</p>}
        </form>}
      </div>
    </Panel>
  );
}
