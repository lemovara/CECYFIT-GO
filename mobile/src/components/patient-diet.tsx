import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mealDate, mealStatusLabel, readMeals, saveMealStatus, type Meal, type MealStatus } from '@/lib/patient-meals';

export function PatientDiet({ patientId }: { patientId: string }) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const day = mealDate(offset);
  const [result, setResult] = useState<{ day: string; attempt: number; meals?: Meal[] }>();

  useFocusEffect(useCallback(() => {
    let active = true;
    void readMeals(patientId, { date: day })
      .then((meals) => { if (active) setResult({ day, attempt, meals }); })
      .catch(() => { if (active) setResult({ day, attempt }); });
    return () => { active = false; };
  }, [patientId, day, attempt]));

  const current = result?.day === day && result.attempt === attempt ? result : undefined;
  const label = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis dietas</Text>
      <View style={styles.dayControls}>
        <Action label="Anterior" onPress={() => setOffset((previous) => previous - 1)} />
        <Action label="Hoy" onPress={() => { setOffset(0); setAttempt((previous) => previous + 1); }} />
        <Action label="Siguiente" onPress={() => setOffset((previous) => previous + 1)} />
      </View>
      <Text style={styles.body}>{label}</Text>
      {!current && <ActivityIndicator accessibilityLabel="Cargando menú" />}
      {current && !current.meals && <>
        <Text accessibilityRole="alert" style={styles.body}>No pudimos cargar tu menú.</Text>
        <Action label="Reintentar" onPress={() => setAttempt((previous) => previous + 1)} />
      </>}
      {current?.meals?.length === 0 && <Text style={styles.body}>Tu profesional todavía no ha asignado comidas para este día.</Text>}
      {current?.meals?.map((meal) => (
        <Link key={meal.id} href={{ pathname: '/pantalla/[slug]', params: { slug: 'platillo', mealId: meal.id } }} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.heading}>{meal.scheduled_time.slice(0, 5)} · {meal.name}</Text>
            <Text style={styles.body}>{mealStatusLabel(meal.status)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

export function PatientMealDetail({ patientId, mealId, onBack }: { patientId: string; mealId: string; onBack: () => void }) {
  const [result, setResult] = useState<{ attempt: number; meal?: Meal; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const current = result?.attempt === attempt ? result : undefined;
  const meal = current?.meal;

  useFocusEffect(useCallback(() => {
    let active = true;
    void readMeals(patientId, { id: mealId })
      .then(([entry]) => { if (active) setResult({ attempt, meal: entry, error: entry ? undefined : 'Esta comida no está disponible.' }); })
      .catch(() => { if (active) setResult({ attempt, error: 'No pudimos consultar esta comida.' }); });
    return () => { active = false; };
  }, [patientId, mealId, attempt]));

  async function record(status: MealStatus) {
    if (!meal || saving || meal.status === status) return;
    setSaving(true);
    setMessage('');
    try {
      await saveMealStatus(meal.id, status);
      setResult({ attempt, meal: { ...meal, status } });
      setMessage('Registro guardado.');
    } catch {
      setMessage('No pudimos guardar el registro. Vuelve a intentarlo.');
    } finally {
      setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Action label="Volver a Dietas" onPress={onBack} />
      {!current && <ActivityIndicator accessibilityLabel="Cargando platillo" />}
      {current?.error && <>
        <Text accessibilityRole="alert" style={styles.body}>{current.error}</Text>
        <Action label="Reintentar" onPress={() => setAttempt((previous) => previous + 1)} />
      </>}
      {meal && <>
        <Text style={styles.title}>{meal.name}</Text>
        <Text style={styles.body}>{meal.scheduled_time.slice(0, 5)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
        {meal.ingredients ? <View style={styles.card}><Text style={styles.heading}>Ingredientes y porciones</Text><Text style={styles.body}>{meal.ingredients}</Text></View> : null}
        {meal.notes ? <View style={styles.card}><Text style={styles.heading}>Indicaciones</Text><Text style={styles.body}>{meal.notes}</Text></View> : null}
        <Text style={styles.heading}>{mealStatusLabel(meal.status)}</Text>
        {meal.meal_date <= mealDate() && <>
          <Action label="Marcar como consumida" disabled={saving || meal.status === 'CONSUMED'} onPress={() => void record('CONSUMED')} />
          <Action label="Marcar como no consumida" disabled={saving || meal.status === 'SKIPPED'} onPress={() => void record('SKIPPED')} />
        </>}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.5 }]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  title: { color: '#1B2A4A', fontSize: 27, fontWeight: '900' },
  heading: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  body: { color: '#526580', lineHeight: 20 },
  dayControls: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: '#E7EDFF', borderRadius: 10, padding: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#1C4DFF', fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 14, gap: 6 },
});
