"use client";

import { useEffect, useState } from "react";
import { Btn, Desk, Panel, Stat, Table } from "@/components/cecyfit/ui";
import { getPatients } from "./service";
import type { Patient } from "./types";

export function ProfessionalOverview({ tracking }: { tracking: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; patients?: Patient[] }>();

  useEffect(() => {
    let active = true;
    void getPatients()
      .then((patients) => { if (active) setResult({ attempt, patients }); })
      .catch(() => { if (active) setResult({ attempt }); });
    return () => { active = false; };
  }, [attempt]);

  const current = result?.attempt === attempt ? result : undefined;
  const patients = current?.patients;
  return (
    <Desk nav={tracking ? "Seguimiento" : "Inicio"} title={tracking ? "Seguimiento de pacientes" : "Panel profesional"}
      actions={tracking ? <Btn to="H2" variant="secondary">Pacientes</Btn> : <Btn to="H2a">Registrar paciente</Btn>}>
      {!current && <p role="status">Cargando pacientes…</p>}
      {current && !patients && <div className="space-y-2"><p role="alert">No se pudo cargar la lista de pacientes.</p>
        <Btn onClick={() => setAttempt((previous) => previous + 1)}>Reintentar</Btn>
      </div>}
      {patients && !tracking && <>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pacientes registrados" value={String(patients.length)} />
          <Stat label="Pacientes activos" value={String(patients.filter(({ status }) => status === "ACTIVE").length)} />
          <Stat label="Cuentas vinculadas" value={String(patients.filter(({ patient_user_id }) => patient_user_id).length)} />
        </div>
        <Panel title="Accesos rápidos">
          <div className="flex flex-wrap gap-2">
            <Btn to="H2" variant="secondary">Ver pacientes</Btn>
            <Btn to="H6" variant="secondary">Consultar seguimiento</Btn>
          </div>
        </Panel>
      </>}
      {patients && tracking && <Panel title="Registro nutricional por paciente">
        {patients.length ? <Table head={["Paciente", "Cuenta móvil", "Acción"]} rows={patients.map((item) => [
          item.full_name,
          item.patient_user_id ? "Vinculada" : "Pendiente",
          <Btn key="action" to="H2g" patientId={item.id} variant="secondary">Ver seguimiento</Btn>,
        ])} /> : <p>Registra un paciente para consultar su seguimiento.</p>}
      </Panel>}
    </Desk>
  );
}
