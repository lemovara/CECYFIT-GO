import { ThemeProvider, DefaultTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AppTabs from '@/components/app-tabs';
import { useState } from 'react';
import { PatientAccess } from '@/components/patient-access';
import { PatientSession, usePatientAccess } from '@/lib/patient-session';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [demo, setDemo] = useState(false);
  const { pending, session, access, refresh } = usePatientAccess();

  async function closeSession() {
    if (demo) {
      setDemo(false);
      return null;
    }
    const result = await supabase?.auth.signOut();
    return result?.error ? 'No pudimos cerrar tu sesión.' : null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="dark" />
      {demo || access?.patient ? (
        <PatientSession patient={demo ? null : access?.patient ?? null} userId={demo ? null : session?.user.id ?? null} accessOffline={!demo && Boolean(access?.offline)} accessCheckedAt={demo ? undefined : access?.checkedAt} retryAccess={refresh} closeSession={closeSession}>
          <AppTabs key={demo ? 'demo' : session?.user.id} />
        </PatientSession>
      ) : (
        <PatientAccess
          key={session?.user.id ?? 'signed-out'}
          pending={pending}
          signedIn={Boolean(session)}
          error={access?.error}
          onRetry={refresh}
          onDemo={() => setDemo(true)}
          onSignOut={closeSession}
        />
      )}
    </ThemeProvider>
  );
}
