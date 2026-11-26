import { HydrationQueue, type PendingHydration } from './hydration-queue-core';
import { hydrationOfflineAvailable, hydrationStorage } from './hydration-storage';
import { supabase } from './supabase';
import { withRequestTimeout } from './request-timeout';

const listeners = new Set<() => void>();
const queue = new HydrationQueue(hydrationStorage,() => listeners.forEach(listener => listener()));
export { hydrationOfflineAvailable };
export const subscribeHydration = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const listPendingHydration = (userId: string,patientId: string) => queue.list(userId,patientId);
export const enqueueHydration = (userId: string,entry: PendingHydration) => queue.enqueue(userId,entry);
export async function syncPendingHydration(userId: string,patientId: string) {
  const client=supabase;
  if (!hydrationOfflineAvailable || !client) return { sent:0,pending:0 };
  return queue.sync(userId,patientId,async entry => {
    const { data,error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('La sesión cambió.');
    const result = await withRequestTimeout(signal => client.rpc('record_hydration', { p_request_id:entry.id,
      p_patient_id:entry.patientId,p_day:entry.day,p_amount_ml:entry.amount }).abortSignal(signal));
    if (result.error) throw result.error;
  });
}
