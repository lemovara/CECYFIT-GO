import { MealStatusQueue, type PendingMealStatus, type StatusResponse } from './meal-status-queue-core';
import { mealStatusStorage, statusStorageAvailable } from './meal-status-storage';
import { supabase } from './supabase';
export { statusStorageAvailable };
export type { PendingMealStatus } from './meal-status-queue-core';

const listeners = new Set<() => void>();
const queue = new MealStatusQueue(mealStatusStorage, () => listeners.forEach(listener => listener()));
export const subscribeMealStatusQueue = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const listPendingMealStatuses = (userId: string, patientId: string) => queue.list(userId, patientId);
export const enqueueMealStatus = (userId: string, operation: PendingMealStatus) => queue.enqueue(userId, operation);
export const discardMealStatusConflict = (userId: string, patientId: string, id: string) => queue.discardConflict(userId, patientId, id);

export async function syncPendingMealStatuses(userId: string, patientId: string) {
  const client = supabase;
  if (!statusStorageAvailable || !client) return;
  await queue.sync(userId, patientId, async entry => {
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== userId) throw new Error('La sesión cambió.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await client.rpc('record_meal_status_conditional', {
        p_request_id: entry.id, p_meal_id: entry.mealId, p_status: entry.status,
        p_expected_revision: entry.expectedRevision, p_expected_logged_at: entry.expectedLoggedAt,
      }).abortSignal(controller.signal);
    } finally { clearTimeout(timeout); }
    const { data, error } = response;
    if (error) throw error;
    if (!data || (data.result !== 'applied' && data.result !== 'conflict')) throw new Error('Respuesta de sincronización inválida.');
    if (data.result === 'conflict' && (!['plan_changed', 'status_changed'].includes(data.reason) ||
      !Number.isInteger(data.revision) || ![null, 'CONSUMED', 'SKIPPED'].includes(data.status) ||
      !(data.logged_at === null || typeof data.logged_at === 'string'))) throw new Error('Conflicto inválido.');
    return data as StatusResponse;
  });
}
