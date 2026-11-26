import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { mealDate } from '@/lib/patient-meals';
import { supabase } from '@/lib/supabase';
import { usePatient } from '@/lib/patient-session';
import { hydrationTotals, type PendingHydration } from '@/lib/hydration-queue-core';
import { enqueueHydration, hydrationOfflineAvailable, listPendingHydration, subscribeHydration, syncPendingHydration } from '@/lib/hydration-queue';
import { withRequestTimeout } from '@/lib/request-timeout';

export function PatientHydration({ patientId }: { patientId: string }) {
  const { userId } = usePatient();
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ patient: string; user: string | null; day: string; attempt: number; rows?: { id: string; amount_ml: number }[]; goal?: number | null }>();
  const [local, setLocal] = useState<{ patient: string; user: string | null; day: string; attempt: number; rows?: PendingHydration[]; error?: boolean }>();
  const pending = useRef<{ id: string; day: string; amount: number } | null>(null);
  const saving = useRef(false);
  const day = mealDate();
  const current = result?.patient === patientId && result.user === userId && result.day === day && result.attempt === attempt ? result : undefined;
  const currentLocal = local?.patient === patientId && local.user === userId && local.day === day && local.attempt === attempt ? local : undefined;

  useFocusEffect(useCallback(() => {
    if (!supabase) return;
    let active = true;
    const client = supabase;
    const unsubscribe = subscribeHydration(() => { if (active) setAttempt(value => value + 1); });
    if (hydrationOfflineAvailable && userId) {
      void listPendingHydration(userId,patientId).then(rows => { if (active) setLocal({ patient:patientId,user:userId,day,attempt,rows:rows.filter(row => row.day === day) }); })
        .catch(() => { if (active) setLocal({ patient:patientId,user:userId,day,attempt,error:true }); });
    } else setLocal({ patient:patientId,user:userId,day,attempt,rows:[] });
    void Promise.all([
      withRequestTimeout(signal => client.from('hydration_logs').select('id,amount_ml').eq('patient_id', patientId).eq('log_date', day).abortSignal(signal)),
      withRequestTimeout(signal => client.from('patient_care_profiles').select('water_goal_ml').eq('patient_id', patientId).abortSignal(signal).maybeSingle()),
    ]).then(([logs, care]) => {
      if (!active) return;
      if (logs.error || care.error) setResult({ patient:patientId,user:userId,attempt,day });
      else setResult({ patient:patientId,user:userId,attempt,day,goal:care.data?.water_goal_ml ?? null,rows:logs.data });
    }).catch(() => { if (active) setResult({ patient:patientId,user:userId,attempt,day }); });
    return () => { active = false; unsubscribe(); };
  }, [patientId, day, attempt, userId]));

  async function record(amount: number) {
    if (!supabase || saving.current) return;
    if (!Number.isInteger(amount) || amount < 1 || amount > 5000) {
      setFailed(true);
      setMessage('Ingresa una cantidad entera entre 1 y 5000 ml.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setFailed(false);
    setMessage('');
    try {
      const previous = pending.current;
      const request = previous?.amount === amount && previous.day === day ? previous : { id: randomUUID(), day, amount };
      pending.current = request;
      if (hydrationOfflineAvailable && userId) {
        await enqueueHydration(userId,{ id:request.id,patientId,day,amount });
        void syncPendingHydration(userId,patientId).catch(() => {});
      } else {
        const { error } = await withRequestTimeout(signal => supabase!.rpc('record_hydration', {
          p_request_id: request.id, p_patient_id: patientId, p_day: day, p_amount_ml: amount,
        }).abortSignal(signal));
        if (error) throw error;
      }
      pending.current = null;
      setCustom('');
      setMessage(hydrationOfflineAvailable && userId ? `Guardaste ${amount} ml en el dispositivo; se sincronizarán.` : `Guardaste ${amount} ml.`);
      setAttempt((value) => value + 1);
    } catch (error) {
      setFailed(true);
      setMessage(error && typeof error === 'object' && 'code' in error && error.code === '42501'
        ? 'Comprueba que tu cuenta esté vinculada a una ficha activa.'
        : 'No pudimos guardar el registro. Puedes reintentar con la misma cantidad.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const totals = hydrationTotals(current?.rows ?? null,currentLocal?.rows ?? []);
  const total = totals.confirmed === null ? undefined : totals.confirmed + totals.pending;
  const progress = current?.goal && total !== undefined && currentLocal?.rows ? Math.min(100, Math.round(total / current.goal * 100)) : undefined;
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Hidratación de hoy</Text>
    {!current && <ActivityIndicator accessibilityLabel="Cargando hidratación" />}
    {current?.rows && <>
      <View style={{flexDirection:'row', alignItems:'center', gap:16}}><View accessibilityLabel="Vaso de hidratación" style={{height:100,width:58,borderWidth:2,borderColor:'#1C4DFF',borderRadius:12,overflow:'hidden',justifyContent:'flex-end'}}><View style={{height: `${progress ?? 0}%`, backgroundColor:'#4F78FF'}} /></View><Text style={styles.heading}>{totals.confirmed} ml confirmados</Text></View>
      <Text>{current.goal ? `Meta diaria · ${current.goal} ml` : 'Tu profesional aún no ha indicado una meta.'}</Text>
      {progress !== undefined && <View accessibilityRole="progressbar" accessibilityLabel="Progreso de hidratación"
        accessibilityValue={{ min: 0, max: 100, now: progress }} style={styles.track}>
        <View style={[styles.progress, { width: `${progress}%` }]} />
      </View>}
    </>}
    {current && !current.rows && <>
      <Text accessibilityRole="alert">No pudimos cargar tus registros.</Text>
      <Action label="Reintentar consulta" disabled={busy} onPress={() => setAttempt((value) => value + 1)} />
    </>}
    {!currentLocal && <Text>Cargando registros pendientes…</Text>}
    {currentLocal?.error && <Text accessibilityRole="alert">No se pudo consultar la cola local de hidratación.</Text>}
    {currentLocal?.rows && totals.pendingCount > 0 && <><Text>{totals.pending} ml pendientes de sincronizar{!current?.rows ? '; el total confirmado no está disponible' : ''}.</Text>
      <Action label="Reintentar sincronización" disabled={busy} onPress={() => { if (userId) void syncPendingHydration(userId,patientId).then(value => { if (value.pending) setMessage('Hay registros pendientes. Revisa la conexión.'); }).catch(() => setMessage('No se pudo sincronizar.')); }} /></>}
    <Action label="Registrar 250 ml" disabled={busy} onPress={() => void record(250)} />
    <TextInput accessibilityLabel="Cantidad de agua en mililitros" keyboardType="number-pad"
      value={custom} onChangeText={setCustom} editable={!busy} maxLength={4} placeholder="Otra cantidad en ml" style={styles.input} />
    <Action label={busy ? 'Guardando…' : 'Registrar cantidad'} disabled={busy} onPress={() => void record(Number(custom))} />
    {message ? <Text accessibilityRole={failed ? 'alert' : undefined} accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && { opacity: .6 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, gap: 10 },
  heading: { color: '#1B2A4A', fontSize: 16, fontWeight: '800' },
  track: { height: 8, backgroundColor: '#E7EDFF', borderRadius: 4, overflow: 'hidden' },
  progress: { backgroundColor: '#1C4DFF', height: '100%' },
  button: { backgroundColor: '#E7EDFF', alignSelf: 'flex-start', padding: 10, borderRadius: 8 },
  buttonText: { color: '#1C4DFF', fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 8, borderColor: '#D6DDEB', padding: 10 },
});
