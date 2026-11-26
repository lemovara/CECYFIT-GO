"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/clients";

type Record = { id: string; patient_user_id: string; amount_ml: number; created_at: string };
const clock = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Mexico_City" });

export function PatientHydrationSummary({ patientId, date }: { patientId: string; date: string }) {
  const [result, setResult] = useState<{ records: Record[]; goal: number | null } | null>();
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("hydration_logs").select("id,patient_user_id,amount_ml,created_at")
        .eq("patient_id", patientId).eq("log_date", date).order("created_at", { ascending: false }),
      supabase.from("patient_care_profiles").select("water_goal_ml").eq("patient_id", patientId).maybeSingle(),
    ]).then(([logs, care]) => {
      if (active) setResult(logs.error || care.error ? null : { records: logs.data, goal: care.data?.water_goal_ml ?? null });
    }).catch(() => { if (active) setResult(null); });
    return () => { active = false; };
  }, [date, patientId]);

  return <section className="space-y-2 rounded-xl border border-line p-4">
    <h3 className="font-extrabold">Hidratación</h3>
    {result === undefined && <p role="status">Cargando hidratación…</p>}
    {result === null && <p role="alert">No pudimos consultar la hidratación. Pulsa Actualizar para reintentar.</p>}
    {result && <>
      <p><b>{result.records.reduce((total, entry) => total + entry.amount_ml, 0)} ml registrados</b>
        {result.goal ? ` · Meta actual de ${result.goal} ml` : " · Sin meta configurada"}</p>
      {result.records.length > 0 && <details>
        <summary className="cursor-pointer">Ver registros</summary>
        <ul>{result.records.map((entry) => <li key={`${entry.patient_user_id}:${entry.id}`}>
          {entry.amount_ml} ml · Capturado a las {clock.format(new Date(entry.created_at))}
        </li>)}</ul>
      </details>}
    </>}
  </section>;
}
