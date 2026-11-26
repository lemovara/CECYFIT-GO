"use client";
import { useEffect, useState } from "react";
import { Desk, Panel } from "@/components/cecyfit/ui";
import { getPatients } from "./service";
import { PatientChat } from "./PatientChat";
import type { Patient } from "./types";
export function ProfessionalChat() {
  const [patients, setPatients] = useState<Patient[]>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void getPatients().then(items => { if (active) setPatients(items.filter(p => p.status === "ACTIVE" && p.patient_user_id)); }).catch(() => { if (active) setError("No se pudieron cargar los pacientes."); }); return () => { active = false; }; }, []);
  return <Desk nav="Chat" title="Mensajes" crumbs="Comunicación - Chat"><div className="grid gap-4 md:grid-cols-[250px_1fr]"><Panel title="Conversaciones">{error && <p role="alert">{error}</p>}{!patients && !error && <p>Cargando...</p>}{patients?.length === 0 && <p>Aún no hay pacientes vinculados.</p>}{patients?.map(p => <button key={p.id} type="button" aria-pressed={selected === p.id} onClick={() => setSelected(p.id)} className="mb-2 block w-full rounded-lg bg-fill p-3 text-left font-bold aria-pressed:outline-2 aria-pressed:outline-blue">{p.full_name}</button>)}</Panel>{selected ? <PatientChat key={selected} patientId={selected} /> : <Panel title="Chat"><p>Selecciona un paciente para ver la conversación.</p></Panel>}</div></Desk>;
}
