import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Patient = { id: string; full_name: string };
type Access = {
  userId: string;
  attempt: number;
  patient: Patient | null;
  error: string;
};

const PatientContext = createContext<{
  patient: Patient | null;
  closeSession: () => Promise<string | null>;
}>({ patient: null, closeSession: async () => null });

export const usePatient = () => useContext(PatientContext);

export function usePatientAccess() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [access, setAccess] = useState<Access>();
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;

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
    async function readAccess() {
      const { data: profile, error: profileError } = await client!
        .from('profiles').select('role').eq('id', userId!).maybeSingle();
      if (!active) return;
      if (profileError || profile?.role !== 'PACIENTE') {
        setAccess({ userId: userId!, attempt, patient: null, error: profileError
          ? 'No pudimos consultar tu perfil. Vuelve a intentarlo.'
          : 'Esta app requiere una cuenta de paciente.' });
        return;
      }
      const { data: patient, error } = await client!.from('patients')
        .select('id,full_name').eq('patient_user_id', userId!).eq('status', 'ACTIVE').maybeSingle();
      if (active) setAccess({ userId: userId!, attempt, patient, error: error
        ? 'No pudimos comprobar tu vinculación. Vuelve a intentarlo.' : '' });
    }
    void readAccess();
    return () => { active = false; };
  }, [userId, attempt]);

  const currentAccess = access?.userId === userId && access?.attempt === attempt ? access : undefined;
  return {
    session,
    pending: session === undefined || Boolean(userId && !currentAccess),
    access: currentAccess,
    refresh: () => setAttempt((previous) => previous + 1),
  };
}

export function PatientSession({ patient, closeSession, children }: {
  patient: Patient | null;
  closeSession: () => Promise<string | null>;
  children: ReactNode;
}) {
  return <PatientContext.Provider value={{ patient, closeSession }}>{children}</PatientContext.Provider>;
}
