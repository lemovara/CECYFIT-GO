"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "@/components/cecyfit/ui";
import { supabase } from "@/lib/supabase/clients";
import type { Patient } from "./types";

type Care = { goal: string; restrictions: string; height_cm: number | null; weight_kg: number | null; water_goal_ml: number | null };
const blank: Care = { goal: "", restrictions: "", height_cm: null, weight_kg: null, water_goal_ml: null };
const field = "mt-1 block w-full rounded-lg border border-line p-2";

export function PatientCare({ patient }: { patient: Patient }) {
  const [care, setCare] = useState<Care>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("patient_care_profiles").select("goal,restrictions,height_cm,weight_kg,water_goal_ml")
      .eq("patient_id", patient.id).maybeSingle().then(({data,error}) => {
        if (!active) return;
        if (error) setError("No se pudo cargar la información nutricional.");
        else setCare(data ?? blank);
      });
    return () => { active = false; };
  }, [patient.id, attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || patient.status !== "ACTIVE") return;
    const form = new FormData(event.currentTarget);
    const quantity = (key: string) => form.get(key) ? Number(form.get(key)) : null;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { error } = await supabase.from("patient_care_profiles").upsert({
        patient_id: patient.id, goal: String(form.get("goal") ?? "").trim(),
        restrictions: String(form.get("restrictions") ?? "").trim(),
        height_cm: quantity("height"), weight_kg: quantity("weight"), water_goal_ml: quantity("water"),
      });
      if (error) throw error;
      setSaved(true);
    } catch {
      setError("No se pudo guardar la ficha. Comprueba los campos y que esté activa.");
    } finally {
      setSaving(false);
    }
  }

  return <Panel title="Información nutricional compartida con el paciente">
    {!care && !error && <p role="status">Cargando ficha nutricional…</p>}
    {error && <p role="alert">{error} {!care && <button className="underline" onClick={() => {
      setError("");
      setAttempt((value) => value + 1);
    }}>Reintentar</button>}</p>}
    {care && <form onSubmit={save}>
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={saving || patient.status !== "ACTIVE"}>
        <label>Estatura (cm)<input className={field} name="height" type="number" min="40" max="260" step=".1" defaultValue={care.height_cm ?? ""} /></label>
        <label>Peso (kg)<input className={field} name="weight" type="number" min="1" max="500" step=".1" defaultValue={care.weight_kg ?? ""} /></label>
        <label>Objetivo<textarea className={field} name="goal" maxLength={1500} defaultValue={care.goal} /></label>
        <label>Restricciones alimentarias<textarea className={field} name="restrictions" maxLength={1500} defaultValue={care.restrictions} /></label>
        <label>Meta diaria de agua (ml)<input className={field} name="water" type="number" min="1" max="20000" defaultValue={care.water_goal_ml ?? ""} /></label>
        {patient.status === "ACTIVE" && <button className="justify-self-start rounded-lg bg-blue px-3 py-2 font-bold text-white" type="submit">
          {saving ? "Guardando…" : "Guardar ficha"}
        </button>}
      </fieldset>
      {saved && <p role="status">Ficha guardada.</p>}
    </form>}
  </Panel>;
}
