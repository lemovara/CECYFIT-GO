import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mealDate, shiftMealDate } from '@/lib/patient-meals';
import { supabase } from '@/lib/supabase';

type Exercise = { name: string; sets: string; repetitions: string; rest: string; instructions: string; image1?: string; image2?: string };
type Workout = { id: string; title: string; exercises: Exercise[]; workout_logs: { status: string; exercise_index: number }[] };
type WorkoutStatus = 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';

const currentTime = () => Date.now();
const statusLabel = (status?: string) => status === 'COMPLETED' ? 'Completada' : status === 'PAUSED' ? 'En pausa' : status === 'INTERRUPTED' ? 'Interrumpida' : 'Pendiente';
const dayLabel = (day: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

export function PatientWorkouts({ patientId }: { patientId: string }) {
  const [day, setDay] = useState(() => mealDate());
  const [calendarCenter, setCalendarCenter] = useState(() => mealDate());
  const [result, setResult] = useState<{ key: string; workouts?: Workout[] }>();
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const today = mealDate();
  const key = `${patientId}:${day}:${attempt}`;
  useFocusEffect(useCallback(() => {
    if (!supabase) { setResult({ key }); return; }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    void Promise.resolve(supabase.from('patient_workouts').select('id,title,exercises,workout_logs(status,exercise_index)')
      .eq('patient_id', patientId).eq('activity_date', day).order('created_at').abortSignal(controller.signal))
      .then(({ data, error: queryError }) => { if (active) setResult(queryError ? { key } : { key, workouts: data as Workout[] }); })
      .catch(() => { if (active) setResult({ key }); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [patientId, day, key]));
  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  const current = result?.key === key ? result : undefined;
  const workout = current?.workouts?.find((item) => item.id === selected);
  const log = workout?.workout_logs[0];
  const position = Math.min(log?.exercise_index ?? 0, Math.max(0, (workout?.exercises.length ?? 1) - 1));
  const exercise = workout?.exercises[position];
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  async function save(status: WorkoutStatus, exerciseIndex: number, close = false) {
    if (!supabase || !workout || busy) return;
    setBusy(true); setError('');
    try {
      const { error: saveError } = await supabase.rpc('record_workout', { p_workout_id: workout.id, p_status: status, p_exercise_index: exerciseIndex });
      if (saveError) throw saveError;
      setDeadline(null);
      if (close) setRunning(false);
      setAttempt((value) => value + 1);
    } catch { setError('No se pudo guardar el avance. Revisa tu conexión y vuelve a intentar.'); }
    finally { setBusy(false); }
  }
  function closeRoutine() {
    if (busy) return;
    if (!workout) { setRunning(false); return; }
    Alert.alert('¿Salir de la rutina?', 'Guarda tu avance para continuar después.', [
      { text: 'Seguir entrenando', style: 'cancel' },
      { text: 'Marcar como interrumpida', onPress: () => void save('INTERRUPTED', position, true) },
      { text: 'Pausar y continuar después', onPress: () => void save('PAUSED', position, true) },
    ]);
  }
  function startRest() {
    // The professional enters rest as seconds, optionally followed by "s" or "seg".
    const match = exercise?.rest?.trim().match(/^(\d+)\s*(?:s|seg|segundos?)?$/i);
    const seconds = match ? Number(match[1]) : 0;
    if (!seconds || seconds > 3600) { Alert.alert('Descanso', 'El descanso debe indicarse en segundos, por ejemplo 90 s.'); return; }
    const start = currentTime(); setNow(start); setDeadline(start + seconds * 1000);
  }
  function selectDay(value: string) { setDay(value); setSelected(null); setError(''); }

  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Actividad física</Text>
    <Text>Calendario de actividad</Text>
    <View style={styles.days}><Button label="Anterior" onPress={() => setCalendarCenter(value => shiftMealDate(value, -5))} /><Button label="Hoy" onPress={() => { setCalendarCenter(today); selectDay(today); }} /><Button label="Siguiente" onPress={() => setCalendarCenter(value => shiftMealDate(value, 5))} /></View>
    <View style={styles.days}>{[-2, -1, 0, 1, 2].map((offset) => {
      const date = shiftMealDate(calendarCenter, offset);
      return <Pressable key={date} accessibilityRole="button" accessibilityState={{ selected: day === date }} onPress={() => selectDay(date)} style={[styles.day, day === date && styles.daySelected]}><Text style={day === date ? styles.daySelectedText : styles.body}>{date === today ? 'Hoy' : dayLabel(date)}</Text></Pressable>;
    })}</View>
    {!current && <ActivityIndicator accessibilityLabel="Cargando actividad" />}
    {current && !current.workouts && <><Text accessibilityRole="alert">No pudimos cargar la actividad.</Text><Button label="Reintentar" onPress={() => setAttempt((value) => value + 1)} /></>}
    {current?.workouts?.length === 0 && <Text>No tienes una rutina asignada para este día.</Text>}
    {!workout && current?.workouts?.map((item) => <View key={item.id} style={styles.exercise}>
      <Text style={styles.heading}>{item.title}</Text>
      <Text>{item.exercises.length} ejercicios · {statusLabel(item.workout_logs[0]?.status)}</Text>
      <Button label="Ver rutina" onPress={() => setSelected(item.id)} />
    </View>)}
    {workout && <>
      <Button label="Volver a actividades" onPress={() => setSelected(null)} />
      <Text style={styles.heading}>{workout.title} · {statusLabel(log?.status)}</Text>
      {workout.exercises.map((item, index) => <View key={index} style={styles.exercise}>
        <Text style={styles.heading}>{index + 1}. {item.name}</Text>
        {(item.image1 || item.image2) && <View style={styles.metrics}>{[item.image1, item.image2].filter((uri): uri is string => Boolean(uri)).map(uri => <Image key={uri} source={{uri}} accessibilityLabel={`Demostración de ${item.name}`} style={{flex: 1, height: 100, borderRadius: 10}} />)}</View>}
        <Text>{item.sets} series · {item.repetitions} repeticiones{item.rest ? ` · Descanso ${item.rest}` : ''}</Text>
        {item.instructions ? <Text>{item.instructions}</Text> : null}
      </View>)}
      {day > today ? <Text>Podrás registrar esta rutina cuando llegue el día programado.</Text> : log?.status === 'COMPLETED' ? <Text>Actividad completada.</Text> : <Button label={log ? 'Continuar rutina' : 'Iniciar rutina'} onPress={() => { setError(''); setRunning(true); }} />}
    </>}
    {error && !running ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Modal visible={running} animationType="slide" onRequestClose={closeRoutine}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>Rutina en curso</Text>
        {!current ? <ActivityIndicator accessibilityLabel="Cargando avance" /> : !workout || !exercise ? <>
          <Text accessibilityRole="alert">{current.workouts ? 'Esta rutina ya no está disponible.' : 'No pudimos actualizar el avance. El último registro guardado permanece en tu cuenta.'}</Text>
          <Button label="Reintentar" onPress={() => setAttempt(value => value + 1)} />
          <Button label="Volver a actividades" onPress={() => { setRunning(false); setSelected(null); }} />
        </> : <>
          <Text style={styles.body}>{workout.title} · Ejercicio {position + 1} de {workout.exercises.length}</Text>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${((position + 1) / workout.exercises.length) * 100}%` }]} /></View>
          <Text style={styles.title}>{exercise.name}</Text>
          {(exercise.image1 || exercise.image2) && <View style={styles.metrics}>{[exercise.image1, exercise.image2].filter((uri): uri is string => Boolean(uri)).map(uri => <Image key={uri} source={{uri}} accessibilityLabel="Demostración del ejercicio" style={{flex: 1, height: 140, borderRadius: 10}} />)}</View>}
          <View style={styles.metrics}><View style={styles.metric}><Text>Series</Text><Text style={styles.heading}>{exercise.sets || '?'}</Text></View><View style={styles.metric}><Text>Repeticiones</Text><Text style={styles.heading}>{exercise.repetitions || '?'}</Text></View></View>
          {exercise.instructions ? <Text style={styles.body}>{exercise.instructions}</Text> : null}
          <View style={styles.exercise}><Text style={styles.heading}>Descanso {exercise.rest || 'sin especificar'}</Text>{deadline !== null && <Text style={styles.title}>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</Text>}<Button label={deadline ? 'Reiniciar temporizador' : 'Iniciar temporizador'} onPress={startRest} /></View>
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
          <Button disabled={busy} label="Pausar rutina" onPress={closeRoutine} />
          {position + 1 < workout.exercises.length ? <Button disabled={busy} label="Siguiente ejercicio" onPress={() => void save('PAUSED', position + 1)} /> : <Button disabled={busy} label="Marcar actividad completada" onPress={() => void save('COMPLETED', workout.exercises.length, true)} />}
        </>}
      </ScrollView>
    </Modal>
  </View>;
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: .6 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10, marginBottom: 16 },
  screen: { backgroundColor: '#fff', flexGrow: 1, padding: 24, paddingTop: 56, gap: 16 },
  heading: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  title: { color: '#1B2A4A', fontSize: 22, fontWeight: '800' },
  body: { color: '#1B2A4A' },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#E7EDFF' },
  daySelected: { backgroundColor: '#1C4DFF' }, daySelectedText: { color: '#fff', fontWeight: '700' },
  exercise: { padding: 10, borderBottomColor: '#E7EDFF', borderBottomWidth: 1, gap: 4 },
  metrics: { flexDirection: 'row', gap: 10 }, metric: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#E7EDFF', gap: 5 },
  progress: { height: 8, borderRadius: 8, backgroundColor: '#E7EDFF', overflow: 'hidden' }, progressFill: { height: 8, backgroundColor: '#50C900' },
  button: { backgroundColor: '#E7EDFF', padding: 10, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  buttonText: { color: '#1C4DFF', fontWeight: '800' },
});
