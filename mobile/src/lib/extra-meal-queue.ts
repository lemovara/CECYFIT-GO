import { ExtraMealQueue, type PendingExtraMeal } from './extra-meal-queue-core';
import { extraMealStorage, offlineStorageAvailable } from './extra-meal-storage';
import { saveExtraMeal } from './patient-meals';
import { supabase } from './supabase';
export type { PendingExtraMeal } from './extra-meal-queue-core';

const listeners = new Set<() => void>();
const queue = new ExtraMealQueue(extraMealStorage, () => listeners.forEach(listener => listener()));
export { offlineStorageAvailable };
export const subscribeExtraMealQueue = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const listPendingExtraMeals = (userId: string, patientId: string) => queue.list(userId, patientId);
export const enqueueExtraMeal = (userId: string, entry: PendingExtraMeal) => queue.enqueue(userId, entry);

export async function syncPendingExtraMeals(userId: string, patientId: string) {
  const client = supabase;
  if (!offlineStorageAvailable || !client) return { sent: 0, pending: 0 };
  return queue.sync(userId, patientId, async entry => {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('La sesión cambió.');
    await saveExtraMeal(patientId, entry.day, entry);
  });
}
