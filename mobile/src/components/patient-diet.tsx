import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mealDate, mealSaveError, mealStatusLabel, readMeals, saveMealStatus, shiftMealDate, type Meal, type MealStatus } from '@/lib/patient-meals';
import { PatientExtraMeals } from './patient-extra-meals';
import { PatientGroceries } from './patient-groceries';

export function PatientDiet({ patientId }: { patientId: string }) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<{ kind: 'extra' | 'groceries' } | { kind: 'meal'; id: string } | null>(null);
  const day = mealDate(offset);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const week = shiftMealDate(day, -((weekday + 6) % 7));
  const [result, setResult] = useState<{ week: string; attempt: number; meals?: Meal[] }>();

  useFocusEffect(useCallback(() => {
    let active = true;
    void readMeals(patientId, { from: week, to: shiftMealDate(week, 6) })
      .then((meals) => { if (active) setResult({ week, attempt, meals }); })
      .catch(() => { if (active) setResult({ week, attempt }); });
    return () => { active = false; };
  }, [patientId, week, attempt]));

  const close = useCallback(() => {
    setScreen(null);
    setAttempt((previous) => previous + 1);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!screen || Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => listener.remove();
  }, [screen, close]));

  const current = result?.week === week && result.attempt === attempt ? result : undefined;
  const meals = current?.meals?.filter((meal) => meal.meal_date === day);
  if (screen?.kind === 'extra') return <PatientExtraMeals patientId={patientId} day={day} onBack={close} />;
  if (screen?.kind === 'meal') return <PatientMealDetail patientId={patientId} mealId={screen.id} onBack={close} />;
  if (screen?.kind === 'groceries' && current?.meals) return <PatientGroceries meals={current.meals} day={day} onBack={close} />;

  const label = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis dietas</Text>
      <View style={styles.dayControls}>
        <Action label="Anterior" onPress={() => setOffset((previous) => previous - 1)} />
        <Action label="Hoy" onPress={() => { setOffset(0); setAttempt((previous) => previous + 1); }} />
        <Action label="Siguiente" onPress={() => setOffset((previous) => previous + 1)} />
      </View>
      <View style={styles.dayControls}>
        {Array.from({ length: 7 }, (_, index) => {
          const thisDay = shiftMealDate(week, index);
          const label = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
            .format(new Date(`${thisDay}T12:00:00Z`));
          return <Pressable accessibilityRole="button" accessibilityState={{ selected: thisDay === day }} key={thisDay}
            onPress={() => setOffset(offset + index - (weekday + 6) % 7)}
            style={[styles.button, thisDay === day && styles.selectedDay]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
        })}
      </View>
      <Text style={styles.body}>{label}</Text>
      {day <= mealDate() && <Action label="Registrar comida fuera del plan" onPress={() => setScreen({ kind: 'extra' })} />}
      {current?.meals && <Action label="Despensa y supermercados" onPress={() => setScreen({ kind: 'groceries' })} />}
      {!current && <ActivityIndicator accessibilityLabel="Cargando menú" />}
      {current && !current.meals && <>
        <Text accessibilityRole="alert" style={styles.body}>No pudimos cargar tu menú.</Text>
        <Action label="Reintentar" onPress={() => setAttempt((previous) => previous + 1)} />
      </>}
      {meals?.length === 0 && <Text style={styles.body}>Tu profesional todavía no ha asignado comidas para este día.</Text>}
      {meals?.map((meal) => (
          <Pressable key={meal.id} accessibilityRole="button" style={styles.card} onPress={() => setScreen({ kind: 'meal', id: meal.id })}>
            {meal.recipe?.photo_url && <Image source={{ uri: meal.recipe.photo_url }} accessibilityLabel={meal.name} style={styles.thumbnail} />}
            <Text style={styles.heading}>{meal.scheduled_time.slice(0, 5)} · {meal.name}</Text>
            <Text style={styles.body}>{mealStatusLabel(meal.status)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
          </Pressable>
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
    } catch (error) {
      setMessage(mealSaveError(error));
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
        {meal.recipe?.photo_url && <Image source={{ uri: meal.recipe.photo_url }} accessibilityLabel={meal.name} style={styles.thumbnail} />}
        <Text style={styles.body}>{meal.scheduled_time.slice(0, 5)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
        {meal.recipe && <Text style={styles.body}>Proteína {meal.recipe.protein} g · Carbohidratos {meal.recipe.carbs} g · Grasas {meal.recipe.fat} g · Fibra {meal.recipe.fiber} g</Text>}
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
  thumbnail: { width: '100%', height: 140, borderRadius: 10, backgroundColor: '#E7EDFF' },
  selectedDay: { borderColor: '#1C4DFF', borderWidth: 1 },
});
