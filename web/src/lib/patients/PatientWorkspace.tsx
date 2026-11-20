"use client";

import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { Btn, Desk, Panel } from "@/components/cecyfit/ui";
import Link from "next/link";
import { hostHref, type HostScreenId } from "@/components/cecyfit/hostRoutes";
import { supabase } from "@/lib/supabase/clients";
import { getPatient } from "./service";
import type { Patient } from "./types";
import { PatientNutrition } from "./PatientNutrition";
import { PatientCare } from "./PatientCare";

export function PatientWorkspace({ patientId, screenId }: { patientId: string; screenId: HostScreenId }) {
  const [result, setResult] = useState<{ patient: Patient | null; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getPatient(patientId)
      .then((patient) => { if (active) setResult({ patient }); })
      .catch(() => { if (active) setResult({ patient: null, error: "No se pudo cargar la ficha." }); });
    return () => { active = false; };
  }, [patientId, attempt]);

  const patient = result?.patient;
  return (
    <Desk nav="Clientes" title={patient?.full_name ?? "Ficha de paciente"} crumbs="Clientes" actions={<Btn to="H2" variant="secondary">Volver a pacientes</Btn>}>
      {!result && <p role="status">Cargando ficha…</p>}
      {result?.error && <div className="space-y-2"><p role="alert">{result.error}</p><Btn onClick={() => {
        setResult(undefined);
        setAttempt(attempt + 1);
      }}>Reintentar</Btn></div>}
      {result && !result.error && !patient && <p>La ficha no está disponible.</p>}
      {patient && <>
        <nav aria-label="Ficha del paciente" className="flex flex-wrap gap-2">
          <Btn to="H2c" variant={screenId === "H2c" ? "blue" : "secondary"}>Información general</Btn>
          <Btn to="H2b" variant={screenId === "H2b" ? "blue" : "secondary"}>Vinculación</Btn>
          <Btn to="H7a" variant={screenId === "H7a" ? "blue" : "secondary"}>Plan nutricional</Btn>
          <Btn to="H2g" variant={screenId === "H2g" ? "blue" : "secondary"}>Seguimiento</Btn>
        </nav>
        <details>
          <summary className="cursor-pointer text-sm font-bold">Más secciones de la ficha</summary>
          <nav aria-label="Secciones adicionales" className="mt-2 flex flex-wrap gap-2">
            <Btn to="H2d" variant="ghost">Salud</Btn>
            <Btn to="H2e" variant="ghost">Módulos</Btn>
            <Btn to="H7b" variant="ghost">Rutina</Btn>
            <Btn to="H7c" variant="ghost">Hábitos</Btn>
            <Btn to="H2h" variant="ghost">Expediente documental</Btn>
            <Btn to="H2i" variant="ghost">Historial</Btn>
          </nav>
        </details>
        {screenId === "H2c" && <><Panel title="Datos básicos">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Correo", patient.email], ["Teléfono", patient.phone],
              ["Fecha de nacimiento", patient.birth_date], ["Sexo registrado", patient.sex],
              ["Estado", patient.status === "ACTIVE" ? "Activo" : "Inactivo"],
              ["Cuenta móvil", patient.patient_user_id ? "Vinculada" : "Pendiente"],
            ].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd>{value || "Sin registrar"}</dd></div>)}
          </dl>
        </Panel><PatientCare patient={patient} /></>}
        {screenId === "H2d" && <PatientCare patient={patient} />}
        {screenId === "H2b" && <Invitation patient={patient} />}
        {(screenId === "H2g" || screenId === "H7a") && <PatientNutrition patient={patient} tracking={screenId === "H2g"} />}
        {screenId !== "H2c" && screenId !== "H2d" && screenId !== "H2b" && screenId !== "H2g" && screenId !== "H7a" && (
          <p>Esta sección todavía no contiene datos de la ficha. <Link className="underline" href={hostHref(screenId)}>Abrir la demostración</Link></p>
        )}
      </>}
    </Desk>
  );
}

function Invitation({ patient }: { patient: Patient }) {
  const [invite, setInvite] = useState<{ token: string; expires_at: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createInvitation() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("create_patient_invitation", { target_patient_id: patient.id }).single();
      if (error || !data) setMessage("No se pudo generar la invitación. Comprueba que la ficha sigue activa y sin vincular.");
      else setInvite(data as { token: string; expires_at: string });
    } finally {
      setBusy(false);
    }
  }

  return <Panel title="Conectar la cuenta móvil">
    {patient.patient_user_id ? <p>Esta ficha ya está vinculada.</p> : patient.status !== "ACTIVE" ? <p>Activa al paciente para crear su invitación.</p> : (
      <div className="space-y-3">
        <p>El paciente puede escanear el QR o escribir el código desde su cuenta. La invitación dura 15 minutos y se usa una sola vez.</p>
        {patient.email && <p>El paciente debe iniciar sesión con el correo registrado en su ficha.</p>}
        {invite && <div className="space-y-2">
          <InvitationQr token={invite.token} />
          <code className="select-all break-all">{invite.token}</code>
          <p>Vence a las {new Date(invite.expires_at).toLocaleTimeString("es-MX")}.</p>
          <Btn variant="secondary" onClick={async () => {
            try { await navigator.clipboard.writeText(invite.token); setMessage("Código copiado."); }
            catch { setMessage("Selecciona el código para copiarlo manualmente."); }
          }}>Copiar código</Btn>
        </div>}
        <button type="button" className="rounded-xl bg-blue px-4 py-2 font-bold text-white disabled:opacity-60" onClick={() => void createInvitation()} disabled={busy}>
          {busy ? "Generando…" : invite ? "Generar otro código" : "Generar QR"}
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    )}
  </Panel>;
}

function InvitationQr({ token }: { token: string }) {
  const qr = qrcode(0, "M");
  qr.addData(token);
  qr.make();
  const size = qr.getModuleCount();
  const pixels = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col) ? `M${col},${row}h1v1h-1z` : "").join(""),
  ).join("");

  return <svg role="img" aria-label="QR de vinculación" viewBox={`-4 -4 ${size + 8} ${size + 8}`} width="200" height="200" shapeRendering="crispEdges">
    <rect x="-4" y="-4" width={size + 8} height={size + 8} fill="white" />
    <path d={pixels} fill="black" />
  </svg>;
}
