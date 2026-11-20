"use client";

import { useContext, useEffect, useMemo, useState } from "react";

import {
  Plus,
  Search,
  ArrowLeft,
  UserPlus,
  Pencil,
  Power,
} from "lucide-react";

import {
  Desk,
  Btn,
  Chip,
  Panel,
  Table,
  HostNavigationContext,
} from "@/components/cecyfit/ui";

import {
  createPatient,
  getPatients,
  updatePatient,
  deactivatePatient,
  activatePatient,
} from "@/lib/patients/service";

import type { Patient } from "@/lib/patients/types";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[12px] text-ink outline-none focus:border-blue";

const labelClass =
  "mb-1 block text-[10px] font-semibold text-mute";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleDateString("es-MX");
}

/* -------------------------------------------------------
   H2 — LISTADO FUNCIONAL DE PACIENTES
------------------------------------------------------- */


export function PatientListFunctional() {
  const navigate = useContext(HostNavigationContext);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    sex: "",
  });

  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getPatients()
      .then((result) => { if (active) setPatients(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Ocurrió un error al consultar los pacientes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  function reloadPatients() {
    setLoading(true);
    setError("");
    setLoadAttempt((previous) => previous + 1);
  }

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        !term ||
        patient.full_name.toLowerCase().includes(term) ||
        (patient.email ?? "").toLowerCase().includes(term) ||
        (patient.phone ?? "").toLowerCase().includes(term);

      const matchesStatus =
        filter === "ALL" || patient.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [patients, search, filter]);

  function startEditing(patient: Patient) {
    setEditingPatient(patient);

    setForm({
      full_name: patient.full_name,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      birth_date: patient.birth_date ?? "",
      sex: patient.sex ?? "",
    });

    setError("");
  }

  function cancelEditing() {
    setEditingPatient(null);
    setError("");
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingPatient || !form.full_name.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updated = await updatePatient(editingPatient.id, {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
      });

      setPatients((current) =>
        current.map((patient) =>
          patient.id === updated.id ? updated : patient,
        ),
      );

      setEditingPatient(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible actualizar al paciente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(patient: Patient) {
    const activating = patient.status === "INACTIVE";

    const confirmed = window.confirm(
      activating
        ? `¿Deseas reactivar a ${patient.full_name}?`
        : `¿Deseas desactivar a ${patient.full_name}? El historial se conservará.`,
    );

    if (!confirmed) return;

    setError("");

    try {
      const updated = activating
        ? await activatePatient(patient.id)
        : await deactivatePatient(patient.id);

      setPatients((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cambiar el estado del paciente.",
      );
    }
  }

  return (
    <Desk
      nav="Clientes"
      title="Pacientes"
      crumbs="Gestión de pacientes"
      actions={
        <Btn
          icon={<Plus size={12} />}
          onClick={() => navigate?.("H2a")}
        >
          Registrar paciente
        </Btn>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as typeof filter)
          }
          className={inputClass + " !w-auto"}
        >
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>

        <Btn variant="secondary" onClick={reloadPatients}>
          Actualizar
        </Btn>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip tone="ink">Total: {patients.length}</Chip>
        <Chip tone="ok">
          Activos: {patients.filter((p) => p.status === "ACTIVE").length}
        </Chip>
        <Chip>
          Inactivos: {patients.filter((p) => p.status === "INACTIVE").length}
        </Chip>
      </div>

      {editingPatient && (
        <Panel title={`Editar paciente: ${editingPatient.full_name}`}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label>
                <span className={labelClass}>Nombre completo *</span>
                <input
                  required
                  value={form.full_name}
                  onChange={(event) =>
                    setForm({ ...form, full_name: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Correo electrónico</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Teléfono</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(event) =>
                    setForm({ ...form, birth_date: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Sexo registrado</span>
                <select
                  value={form.sex}
                  onChange={(event) =>
                    setForm({ ...form, sex: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Sin especificar</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="OTRO">Otro</option>
                  <option value="NO_ESPECIFICADO">
                    Prefiero no especificar
                  </option>
                </select>
              </label>
            </div>

            {error && (
              <p role="alert" className="text-[11px] text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Btn
  variant="secondary"
  onClick={cancelEditing}
>
  Cancelar
</Btn>

              <button
  type="submit"
  disabled={saving}
  className="rounded-2xl border-b-4 border-green-d bg-green px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-60"
>
  {saving ? "Guardando..." : "Guardar cambios"}
</button>
            </div>
          </form>
        </Panel>
      )}

      {error && !editingPatient && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700"
        >
          {error}
        </div>
      )}

      <Panel title="Directorio de pacientes">
        {loading ? (
          <p className="py-6 text-center text-[12px] text-mute">
            Consultando pacientes...
          </p>
        ) : error && patients.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12px] text-red-700">{error}</p>
            <Btn
              className="mt-3"
              variant="secondary"
              onClick={reloadPatients}
            >
              Intentar nuevamente
            </Btn>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-8 text-center">
            <UserPlus className="mx-auto mb-2 text-mute" size={25} />
            <p className="text-[12px] font-bold">
              {patients.length === 0
                ? "Todavía no tienes pacientes registrados."
                : "No hay resultados para esta búsqueda."}
            </p>
            <p className="mt-1 text-[11px] text-mute">
              Los pacientes que registres aparecerán en este directorio.
            </p>

            {patients.length === 0 && (
              <Btn
                className="mt-4"
                onClick={() => navigate?.("H2a")}
                icon={<Plus size={12} />}
              >
                Registrar primer paciente
              </Btn>
            )}
          </div>
        ) : (
          <Table
            head={[
              "Nombre",
              "Correo",
              "Teléfono",
              "Registro",
              "Estado",
              "Acciones",
            ]}
            rows={filteredPatients.map((patient) => [
              patient.full_name,
              patient.email || "Sin correo",
              patient.phone || "Sin teléfono",
              formatDate(patient.created_at),
              patient.status === "ACTIVE" ? (
                <Chip key="status" tone="ok">Activo</Chip>
              ) : (
                <Chip key="status">Inactivo</Chip>
              ),
              <div key="actions" className="flex flex-wrap gap-1">
                <Btn variant="secondary" to="H2c" patientId={patient.id}>Ver ficha</Btn>
                <Btn
                  variant="secondary"
                  onClick={() => startEditing(patient)}
                  icon={<Pencil size={12} />}
                >
                  Editar
                </Btn>

                <Btn
                  variant="secondary"
                  onClick={() => void handleStatusChange(patient)}
                  icon={<Power size={12} />}
                >
                  {patient.status === "ACTIVE"
                    ? "Desactivar"
                    : "Reactivar"}
                </Btn>
              </div>,
            ])}
          />
        )}
      </Panel>
    </Desk>
  );
}


/* -------------------------------------------------------
   H2a — REGISTRO FUNCIONAL DE PACIENTES
------------------------------------------------------- */

export function PatientRegisterFunctional() {
  const navigate = useContext(HostNavigationContext);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Escribe el nombre completo del paciente.");
      return;
    }

    setSaving(true);

    try {
      await createPatient({
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        birth_date: birthDate || null,
        sex: sex || null,
      });

      navigate?.("H2");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar al paciente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Desk
      nav="Clientes"
      title="Registrar paciente"
      crumbs="Pacientes / Nuevo registro"
      actions={
        <Btn
          variant="secondary"
          icon={<ArrowLeft size={12} />}
          onClick={() => navigate?.("H2")}
        >
          Volver al listado
        </Btn>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Datos personales" className="col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelClass}>Nombre completo *</span>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nombre y apellidos"
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Correo electrónico</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@ejemplo.com"
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Teléfono</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Número de teléfono"
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label>
                <span className={labelClass}>Sexo registrado</span>
                <select
                  value={sex}
                  onChange={(event) => setSex(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Sin especificar</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="OTRO">Otro</option>
                  <option value="NO_ESPECIFICADO">Prefiero no especificar</option>
                </select>
              </label>
            </div>

            <p className="mt-3 text-[10px] text-mute">
              Los campos marcados con * son obligatorios.
            </p>
          </Panel>

          <div className="space-y-4">
            <Panel title="Estado del registro">
              <Chip tone="ok">Paciente activo</Chip>
              <p className="mt-2 text-[11px] leading-relaxed text-mute">
                Al guardar, el paciente quedará asociado a la cuenta del
                profesional que inició sesión.
              </p>
            </Panel>

            <Panel title="Protección de datos">
              <p className="text-[11px] leading-relaxed text-mute">
                Los datos se guardarán en la base de datos protegida de
                CECYFIT GO!. El acceso depende de los permisos de la cuenta
                profesional.
              </p>
            </Panel>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Btn
            variant="ghost"
            onClick={() => navigate?.("H2")}
          >
            Cancelar
          </Btn>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl border-b-4 border-green-d bg-green px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Crear paciente"}
          </button>
        </div>
      </form>
    </Desk>
  );
}
