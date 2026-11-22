
import { supabase } from "@/lib/supabase/clients";

import type {
  CreatePatientInput,
  Patient,
  UpdatePatientInput,
} from "./types";

/**
 * Comprueba que exista una sesión y que el usuario
 * tenga el rol PROFESIONAL.
 *
 * Esto evita que un paciente pueda administrar
 * la lista de pacientes de un profesional.
 */
async function requireProfessional(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(
      "Debes iniciar sesión para administrar pacientes."
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "PROFESIONAL") {
    throw new Error(
      "No tienes permisos de profesional para realizar esta operación."
    );
  }

  return user.id;
}

/**
 * CONSULTAR PACIENTES
 *
 * Obtiene exclusivamente los pacientes pertenecientes
 * al profesional que inició sesión.
 */
export async function getPatients(): Promise<Patient[]> {
  const professionalId = await requireProfessional();

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `No se pudieron consultar los pacientes: ${error.message}`
    );
  }

  return (data ?? []) as Patient[];
}

export async function getPatient(patientId: string): Promise<Patient | null> {
  const professionalId = await requireProfessional();
  const { data, error } = await supabase
    .from("patients").select("*").eq("id", patientId)
    .eq("professional_id", professionalId).maybeSingle();
  if (error) throw new Error("No se pudo consultar la ficha del paciente.");
  return data as Patient | null;
}

/**
 * REGISTRAR PACIENTE
 *
 * El professional_id se obtiene de la sesión.
 * Nunca debe recibirse desde el formulario.
 */
export async function createPatient(
  input: CreatePatientInput
): Promise<Patient> {
  const professionalId = await requireProfessional();

  const fullName = input.full_name.trim();

  if (!fullName) {
    throw new Error("El nombre del paciente es obligatorio.");
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      professional_id: professionalId,
      full_name: fullName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      birth_date: input.birth_date || null,
      sex: input.sex || null,
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `No se pudo registrar el paciente: ${error.message}`
    );
  }

  return data as Patient;
}

/**
 * ACTUALIZAR PACIENTE
 *
 * Comprueba que el registro pertenezca al profesional
 * antes de modificarlo.
 */
export async function updatePatient(
  patientId: string,
  input: UpdatePatientInput
): Promise<Patient> {
  const professionalId = await requireProfessional();

  if (input.full_name !== undefined && !input.full_name.trim()) {
    throw new Error("El nombre del paciente no puede quedar vacío.");
  }

 const changes = {
  ...(input.full_name !== undefined
    ? { full_name: input.full_name.trim() }
    : {}),
  ...(input.email !== undefined
    ? { email: input.email?.trim() || null }
    : {}),
  ...(input.phone !== undefined
    ? { phone: input.phone?.trim() || null }
    : {}),
  ...(input.birth_date !== undefined
    ? { birth_date: input.birth_date || null }
    : {}),
  ...(input.sex !== undefined
    ? { sex: input.sex || null }
    : {}),
  updated_at: new Date().toISOString(),
};

  const { data, error } = await supabase
    .from("patients")
    .update(changes)
    .eq("id", patientId)
    .eq("professional_id", professionalId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `No se pudo actualizar el paciente: ${error.message}`
    );
  }

  return data as Patient;
}

/**
 * DESACTIVAR PACIENTE
 *
 * No elimina el registro.
 * Conserva la información y cambia su estado.
 */
export async function deactivatePatient(
  patientId: string
): Promise<Patient> {
  const professionalId = await requireProfessional();

  const { data, error } = await supabase
    .from("patients")
    .update({
      status: "INACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("professional_id", professionalId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `No se pudo desactivar el paciente: ${error.message}`
    );
  }

  return data as Patient;
}
/**
 * Reactiva un paciente sin eliminar ni alterar su historial.
 */
export async function activatePatient(patientId: string) {
  const professionalId = await requireProfessional();

  const { data, error } = await supabase
    .from("patients")
    .update({
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("professional_id", professionalId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
