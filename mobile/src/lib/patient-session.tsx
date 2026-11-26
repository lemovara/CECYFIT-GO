import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { offlineStorageAvailable, syncPendingExtraMeals } from './extra-meal-queue';
import { patientAccessCache } from './patient-access-cache';
import { resolvePatientAccess } from './patient-access-cache-core';
import { syncPendingMealStatuses } from './meal-status-queue';
import { syncPendingHydration } from './hydration-queue';

type Patient = { id: string; full_name: string };
type Access = {
  userId: string;
  attempt: number;
  patient: Patient | null;
  error: string;
  offline: boolean;
  checkedAt?: string;
};

const PatientContext = createContext<{
  patient: Patient | null;
  userId: string | null;
  accessOffline: boolean;
  accessCheckedAt?: string;
  retryAccess: () => void;
  closeSession: () => Promise<string | null>;
}>({ patient: null, userId: null, accessOffline: false, retryAccess: () => {}, closeSession: async () => null });

export const usePatient = () => useContext(PatientContext);

export function usePatientAccess() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [access, setAccess] = useState<Access>();
  const [attempt, setAttempt] = useState(0);
  const [expiredAt, setExpiredAt] = useState<number>();
  const userId = session?.user.id;
  const expiresAt = session?.expires_at;

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    return () => {
      subscription.unsubscribe();
      appState?.remove();
      if (appState) void client.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    async function readAccess() {
      try {
        const value = await resolvePatientAccess(userId!, expiresAt, patientAccessCache,
          () => client!.from('profiles').select('role').eq('id', userId!).abortSignal(controller.signal).maybeSingle(),
          () => client!.from('patients').select('id,full_name').eq('patient_user_id', userId!).eq('status', 'ACTIVE').abortSignal(controller.signal).maybeSingle());
        if (active) setAccess({ userId: userId!, attempt, ...value });
      } catch {
        if (active) setAccess({ userId: userId!, attempt, patient: null, offline: false, error: 'No pudimos comprobar tu acceso. Vuelve a intentarlo.' });
      } finally { clearTimeout(timeout); }
    }
    void readAccess();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [userId, expiresAt, attempt]);

  useEffect(() => {
    if (!userId) return;
    const retry = () => setAttempt(value => value + 1);
    const interval = setInterval(retry, 60000);
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', state => { if (state === 'active') retry(); });
    return () => { clearInterval(interval); appState?.remove(); };
  }, [userId]);

  useEffect(() => {
    if (!access?.offline || !expiresAt) return;
    const timeout = setTimeout(() => { setExpiredAt(expiresAt); setAttempt(value => value + 1); }, Math.max(0, expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timeout);
  }, [access?.offline, expiresAt]);

  const expiredOffline = access?.offline && (!expiresAt || expiredAt === expiresAt);
  const currentAccess = access?.userId === userId ? (expiredOffline ? { ...access, patient: null, offline: false, error: 'La sesión necesita renovarse. Conéctate para continuar.' } : access) : undefined;
  return {
    session,
    pending: session === undefined || Boolean(userId && !currentAccess),
    access: currentAccess,
    refresh: () => setAttempt((previous) => previous + 1),
  };
}

export function PatientSession({ patient, userId, accessOffline, accessCheckedAt, retryAccess, closeSession, children }: {
  patient: Patient | null;
  userId: string | null;
  accessOffline: boolean;
  accessCheckedAt?: string;
  retryAccess: () => void;
  closeSession: () => Promise<string | null>;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!offlineStorageAvailable || !patient || !userId) return;
    const sync = () => { void syncPendingExtraMeals(userId, patient.id).catch(() => {}); void syncPendingMealStatuses(userId, patient.id).catch(() => {}); void syncPendingHydration(userId, patient.id).catch(() => {}); };
    sync();
    const interval = setInterval(sync, 60000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { clearInterval(interval); appState.remove(); };
  }, [patient, userId]);
  return <PatientContext.Provider value={{ patient, userId, accessOffline, accessCheckedAt, retryAccess, closeSession }}>{children}</PatientContext.Provider>;
}
