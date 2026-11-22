
/**
 * Estados posibles de un paciente dentro de HOST.
 * ACTIVE: el paciente está activo.
 * INACTIVE: el paciente está desactivado, pero se conserva su historial.
 */
export type PatientStatus = "ACTIVE" | "INACTIVE";

/**
 * Datos que devuelve Supabase al consultar un paciente.
 * Los nombres de las propiedades corresponden a las columnas
 * de la tabla public.patients.
 */
export interface Patient {
  id: string;
  professional_id: string;
  patient_user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  sex: string | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Datos necesarios para registrar un paciente.
 * No incluimos id ni professional_id porque:
 * - El id lo genera automáticamente la base de datos.
 * - El profesional se obtiene de la sesión autenticada.
 */
export interface CreatePatientInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  sex?: string | null;
}

/**
 * Datos que se pueden modificar posteriormente.
 */
export type UpdatePatientInput = Partial<CreatePatientInput>;
