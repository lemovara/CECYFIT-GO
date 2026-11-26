export type CachedPatient = { id: string; full_name: string };
export type CachedAccess = { patient: CachedPatient; checkedAt: string };
export interface PatientAccessCache {
  read(userId: string): Promise<CachedAccess | null>;
  write(userId: string, value: CachedAccess): Promise<void>;
  clear(userId: string): Promise<void>;
}
type Result<T> = { data: T | null; error: unknown; status: number };
const latestChecks = new Map<string, symbol>();

/** Uses a local copy only when the server could not be reached and the local session remains valid. */
export async function resolvePatientAccess(userId: string, expiresAt: number | undefined, cache: PatientAccessCache,
  getProfile: () => PromiseLike<Result<{ role: string }>>, getPatient: () => PromiseLike<Result<CachedPatient>>) {
  const check = Symbol(userId);
  latestChecks.set(userId, check);
  const latest = () => latestChecks.get(userId) === check;
  try {
  async function offlineOrError(status: number, message: string) {
    if (status === 0 && expiresAt && expiresAt * 1000 > Date.now()) {
      try {
        const saved = await cache.read(userId);
        if (saved && expiresAt * 1000 > Date.now()) return { patient: saved.patient, offline: true, checkedAt: saved.checkedAt, error: '' };
      } catch { /* An unreadable cache never grants access. */ }
    }
    if ((status === 401 || status === 403) && latest()) {
      try { await cache.clear(userId); } catch { /* Never grant access after rejection. */ }
    }
    return { patient: null, offline: false, checkedAt: undefined, error: message };
  }
  const profile = await getProfile();
  if (profile.error) return offlineOrError(profile.status, 'No pudimos consultar tu perfil. Vuelve a intentarlo.');
  if (profile.data?.role !== 'PACIENTE') {
    try { if (latest()) await cache.clear(userId); } catch { /* Server denial still applies. */ }
    return { patient: null, offline: false, checkedAt: undefined, error: 'Esta app requiere una cuenta de paciente.' };
  }
  const result = await getPatient();
  if (result.error) return offlineOrError(result.status, 'No pudimos comprobar tu vinculación. Vuelve a intentarlo.');
  if (!result.data) {
    try { if (latest()) await cache.clear(userId); } catch { /* No cached access is granted. */ }
    return { patient: null, offline: false, checkedAt: undefined, error: '' };
  }
  const checkedAt = new Date().toISOString();
  try { if (latest()) await cache.write(userId, { patient: result.data, checkedAt }); } catch { /* Online use still works. */ }
  return { patient: result.data, offline: false, checkedAt, error: '' };
  } finally { if (latest()) latestChecks.delete(userId); }
}
