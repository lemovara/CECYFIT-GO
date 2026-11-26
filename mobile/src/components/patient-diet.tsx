import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mealDate, mealSaveError, mealStatusLabel, readExtraMeals, readMeals, saveMealStatus, shiftMealDate, type ExtraMeal, type Meal, type MealStatus } from '@/lib/patient-meals';
import { PatientExtraMeals } from './patient-extra-meals';
import { PatientGroceries } from './patient-groceries';
import { PatientNutritionGoals } from './patient-nutrition-goals';
import { usePatient } from '@/lib/patient-session';
import { loadMealDetail, loadMealPlan } from '@/lib/meal-plan-cache-core';
import { mealPlanCache } from '@/lib/meal-plan-cache';
import { summarizeConfirmedIntake, summarizeExtras, summarizeMeals } from '@/lib/meal-day-summary';
import { listPendingExtraMeals, offlineStorageAvailable, subscribeExtraMealQueue } from '@/lib/extra-meal-queue';
import { discardMealStatusConflict, enqueueMealStatus, listPendingMealStatuses, statusStorageAvailable, subscribeMealStatusQueue, syncPendingMealStatuses, type PendingMealStatus } from '@/lib/meal-status-queue';

function usePendingStatuses(userId: string | null | undefined, patientId: string, onSynced?: () => void) {
  const [state, setState] = useState<{ scope: string; rows?: PendingMealStatus[]; error?: boolean }>();
  const previous = useRef<PendingMealStatus[] | undefined>(undefined);
  const scope = `${userId ?? ''}:${patientId}`;
  useFocusEffect(useCallback(() => {
    if (!statusStorageAvailable || !userId) return;
    let active = true;
    const refresh = () => {
      void listPendingMealStatuses(userId, patientId).then(rows => {
        if (!active) return;
        if (previous.current?.some(old => !old.conflict && !rows.some(row => row.id === old.id))) onSynced?.();
        previous.current = rows;
        setState({ scope, rows });
      }).catch(() => { if (active) setState({ scope, error: true }); });
    };
    const unsubscribe = subscribeMealStatusQueue(refresh);
    refresh();
    return () => { active = false; unsubscribe(); };
  }, [userId, patientId, scope, onSynced]));
  if (!statusStorageAvailable || !userId) return { ready: true, rows: [] as PendingMealStatus[], error: false };
  return { ready: state?.scope === scope && Boolean(state.rows), rows: state?.scope === scope ? state.rows ?? [] : [], error: state?.scope === scope && Boolean(state.error) };
}

export function PatientDiet({ patientId }: { patientId: string }) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<{ kind: 'extra' | 'groceries' } | { kind: 'meal'; id: string } | null>(null);
  const { userId, accessOffline, accessCheckedAt, retryAccess } = usePatient();
  const refreshAfterSync = useCallback(() => setAttempt(previous => previous + 1), []);
  const pending = usePendingStatuses(userId, patientId, refreshAfterSync);
  const day = mealDate(offset);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const week = shiftMealDate(day, -((weekday + 6) % 7));
  const [result, setResult] = useState<{ week: string; attempt: number; meals?: Meal[]; offline?: boolean; savedAt?: string }>();
  const [extras, setExtras] = useState<{ scope: string; day: string; attempt: number; remote: ExtraMeal[] | null; pending: ExtraMeal[] | null }>();
  const extraScope = `${userId ?? ''}:${patientId}`;

  useFocusEffect(useCallback(() => {
    let active = true, sequence = 0;
    const refresh = () => {
      const current = ++sequence;
      const local = offlineStorageAvailable && userId ? listPendingExtraMeals(userId, patientId).then(items => items.filter(item => item.day === day)) : Promise.resolve([]);
      void Promise.allSettled([readExtraMeals(patientId, day), local]).then(([remote, pending]) => {
        if (active && current === sequence) setExtras({ scope: extraScope, day, attempt, remote: remote.status === 'fulfilled' ? remote.value : null,
          pending: pending.status === 'fulfilled' ? pending.value : null });
      });
    };
    const unsubscribe = subscribeExtraMealQueue(refresh);
    refresh();
    return () => { active = false; unsubscribe(); };
  }, [userId, patientId, day, attempt, extraScope]));

  useFocusEffect(useCallback(() => {
    let active = true;
    const fetchPlan = () => readMeals(patientId, { from: week, to: shiftMealDate(week, 6) });
    const request = userId ? loadMealPlan(mealPlanCache, userId, patientId, week, fetchPlan)
      : fetchPlan().then(meals => ({ meals, offline: false, savedAt: undefined }));
    void request
      .then((plan) => { if (active) setResult({ week, attempt, ...plan }); })
      .catch(() => { if (active) setResult({ week, attempt }); });
    return () => { active = false; };
  }, [patientId, userId, week, attempt]));

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
  const summary = meals?.length ? summarizeMeals(meals, new Set(pending.rows.map(row => row.mealId))) : null;
  const currentExtras = extras?.scope === extraScope && extras.day === day && extras.attempt === attempt ? extras : undefined;
  const extraSummary = currentExtras ? summarizeExtras(currentExtras.remote ?? [], currentExtras.pending ?? []) : null;
  const intake = summarizeConfirmedIntake(meals ?? null, pending.ready ? new Set(pending.rows.map(row => row.mealId)) : null,
    currentExtras?.remote ?? null, currentExtras?.pending ?? null);
  if (screen?.kind === 'extra') return <PatientExtraMeals patientId={patientId} day={day} onBack={close} cachedMeals={current?.meals} />;
  if (screen?.kind === 'meal') return <PatientMealDetail patientId={patientId} mealId={screen.id} onBack={close} onGroceries={() => setScreen({ kind: 'groceries' })} offlineMeal={current?.meals?.find(meal => meal.id === screen.id)} />;
  if (screen?.kind === 'groceries' && current?.meals) return <PatientGroceries patientId={patientId} meals={current.meals} day={day} onBack={close} />;

  const label = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis dietas</Text>
      {accessOffline && <View style={styles.card}><Text style={styles.body}>Sin conexión: usando la vinculación comprobada el {accessCheckedAt ? new Date(accessCheckedAt).toLocaleString('es-MX') : 'último acceso'}. Los cambios del profesional podrían no aparecer.</Text><Pressable accessibilityRole="button" onPress={retryAccess}><Text style={styles.buttonText}>Comprobar conexión</Text></Pressable></View>}
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
      {current?.offline && <Text accessibilityLiveRegion="polite" style={styles.body}>Sin conexión. Mostrando el menú guardado el {new Date(current.savedAt!).toLocaleString('es-MX')}. Puede no incluir cambios recientes.</Text>}
      {day <= mealDate() && <Action label="Registrar comida fuera del plan" onPress={() => setScreen({ kind: 'extra' })} />}
      {current?.meals && <Action label="Despensa y supermercados" onPress={() => setScreen({ kind: 'groceries' })} />}
      <PatientNutritionGoals patientId={patientId} day={day} intake={intake} planOffline={current?.offline} />
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Consumo registrado del día</Text>
        {(intake.mealsAvailable || intake.extrasAvailable) ? <>
          <Text style={styles.body}>{current?.offline && intake.mealsAvailable ? 'Incluye el estado de comidas guardado en la última consulta; puede estar desactualizado.' : 'Se suman los registros confirmados disponibles.'}</Text>
          {([['kcal', 'Energía', 'kcal'], ['protein', 'Proteína', 'g'], ['carbs', 'Carbohidratos', 'g'], ['fat', 'Grasas', 'g'], ['fiber', 'Fibra', 'g']] as const).map(([key, name, unit]) => <Text key={key} style={styles.body}>{name}: {intake.totals[key].known.toFixed(1)} {unit}{intake.totals[key].missing ? ` · parcial; faltan datos en ${intake.totals[key].missing} registros` : ''}</Text>)}
          {(!intake.mealsAvailable || !intake.extrasAvailable) && <Text style={styles.body}>Total parcial: no se pudieron comprobar {(!intake.mealsAvailable && !intake.extrasAvailable) ? 'las comidas y los alimentos adicionales' : !intake.mealsAvailable ? 'las comidas del plan' : 'los alimentos adicionales'}.</Text>}
          {intake.pendingCount > 0 && <Text style={styles.body}>{intake.pendingCount} registros pendientes o en revisión se muestran por separado y no se suman aquí.</Text>}
        </> : <Text style={styles.body}>No se pudo comprobar el consumo registrado. Reintenta cuando haya conexión.</Text>}
      </View>
      {summary && <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Resumen de comidas asignadas</Text>
        {([['kcal', 'Energía', 'kcal'], ['protein', 'Proteína', 'g'], ['carbs', 'Carbohidratos', 'g'], ['fat', 'Grasas', 'g'], ['fiber', 'Fibra', 'g']] as const).map(([key, label, unit]) => <Text key={key} style={styles.body}>{label}: {summary.planned[key].known.toFixed(1)} {unit}{summary.planned[key].missing ? ` · parcial; faltan ${summary.planned[key].missing}` : ''}</Text>)}
        <Text style={styles.body}>{pending.ready ? `Comidas del plan confirmadas como consumidas: ${summary.confirmedCount} de ${meals!.length}.${summary.pendingCount ? ` Hay ${summary.pendingCount} registros pendientes o en revisión.` : ''}` : 'No se pudo verificar aún si hay registros pendientes.'} Los alimentos adicionales se consultan en su registro.</Text>
        <Text style={styles.body}>Valores estimados según la información disponible del plan.</Text>
      </View>}
      {extraSummary && currentExtras && <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Alimentos adicionales del día</Text>
        {currentExtras.remote === null ? <Text style={styles.body}>No se pudieron consultar los registros del servidor.</Text> : <Text style={styles.body}>Confirmados: {extraSummary.confirmedCount} · {extraSummary.confirmed.kcal.known.toFixed(1)} kcal{extraSummary.confirmed.kcal.missing ? ` · faltan calorías en ${extraSummary.confirmed.kcal.missing}` : ''}.</Text>}
        {currentExtras.pending === null ? <Text style={styles.body}>No se pudieron consultar los registros pendientes del dispositivo.</Text> : <Text style={styles.body}>Pendientes de sincronizar: {extraSummary.pendingCount} · {extraSummary.pending.kcal.known.toFixed(1)} kcal{extraSummary.pending.kcal.missing ? ` · faltan calorías en ${extraSummary.pending.kcal.missing}` : ''}.</Text>}
        {currentExtras.remote !== null && extraSummary.confirmedCount > 0 && <Text style={styles.body}>{([['protein','Proteína'],['carbs','Carbohidratos'],['fat','Grasas']] as const).map(([key, label]) => `${label}: ${extraSummary.confirmed[key].known.toFixed(1)} g${extraSummary.confirmed[key].missing ? ' (parcial)' : ''}`).join(' · ')}</Text>}
        <Text style={styles.body}>Estos registros están separados de los totales del plan.</Text>
      </View>}
      {!current && <ActivityIndicator accessibilityLabel="Cargando menú" />}
      {current && !current.meals && <>
        <Text accessibilityRole="alert" style={styles.body}>No pudimos cargar tu menú.</Text>
        <Action label="Reintentar" onPress={() => setAttempt((previous) => previous + 1)} />
      </>}
      {meals?.length === 0 && <Text style={styles.body}>Tu profesional todavía no ha asignado comidas para este día.</Text>}
      {meals?.map((meal) => (
          <Pressable key={meal.id} accessibilityRole="button" style={styles.card} onPress={() => setScreen({ kind: 'meal', id: meal.id })}>
            {(meal.photo_url || meal.recipe?.photo_url) && <Image source={{ uri: meal.photo_url || meal.recipe?.photo_url || undefined }} accessibilityLabel={meal.name} style={styles.thumbnail} />}
            <Text style={styles.heading}>{meal.scheduled_time.slice(0, 5)} · {meal.name}</Text>
            <Text style={styles.body}>{mealStatusLabel(meal.status)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
            {pending.rows.some(row => row.mealId === meal.id) && <Text style={styles.body}>{pending.rows.find(row => row.mealId === meal.id)?.conflict ? 'Registro requiere revisión' : 'Registro pendiente de sincronización'}</Text>}
          </Pressable>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

export function PatientMealDetail({ patientId, mealId, onBack, onGroceries, offlineMeal }: { patientId: string; mealId: string; onBack: () => void; onGroceries?: () => void; offlineMeal?: Meal }) {
  const [result, setResult] = useState<{ attempt: number; meal?: Meal; error?: string; offline?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { userId } = usePatient();
  const refreshAfterSync = useCallback(() => setAttempt(previous => previous + 1), []);
  const pending = usePendingStatuses(userId, patientId, refreshAfterSync);
  const operation = pending.rows.find(row => row.mealId === mealId);
  const current = result?.attempt === attempt ? result : undefined;
  const meal = current?.meal;

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadMealDetail(async () => (await readMeals(patientId, { id: mealId }))[0], offlineMeal)
      .then(({ meal: entry, offline }) => { if (active) setResult({ attempt, meal: entry, offline, error: entry ? undefined : 'Esta comida no está disponible.' }); })
      .catch(() => { if (active) setResult({ attempt, error: 'No pudimos consultar esta comida.' }); });
    return () => { active = false; };
  }, [patientId, mealId, attempt, offlineMeal]));

  async function record(status: MealStatus) {
    if (!meal || saving || meal.status === status || operation || !pending.ready) return;
    setSaving(true);
    setMessage('');
    try {
      if (statusStorageAvailable && userId) {
        if (!Number.isInteger(meal.revision) || !('status_logged_at' in meal)) {
          setMessage('Conéctate para actualizar el menú antes de registrar esta comida.');
          return;
        }
        const id = randomUUID();
        await enqueueMealStatus(userId, { id, patientId, mealId: meal.id, status,
          expectedRevision: meal.revision!, expectedLoggedAt: meal.status_logged_at ?? null });
        setMessage('Registro guardado en este dispositivo; se sincronizará al recuperar la conexión.');
        void syncPendingMealStatuses(userId, patientId).then(async () => {
          if (!(await listPendingMealStatuses(userId, patientId)).some(row => row.id === id)) {
            setMessage('Registro sincronizado.');
            setAttempt(previous => previous + 1);
          }
        }).catch(() => {});
      } else {
        await saveMealStatus(meal.id, status);
        setResult({ attempt, meal: { ...meal, status } });
        setMessage('Registro guardado.');
      }
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
        {current.offline && <Text style={styles.body}>Sin conexión: esta es la versión guardada del platillo.</Text>}
        <Text style={styles.title}>{meal.name}</Text>
        {(meal.photo_url || meal.recipe?.photo_url) && <Image source={{ uri: meal.photo_url || meal.recipe?.photo_url || undefined }} accessibilityLabel={meal.name} style={styles.thumbnail} />}
        <Text style={styles.body}>{meal.scheduled_time.slice(0, 5)}{meal.kcal !== null ? ` · ${meal.kcal} kcal` : ''}</Text>
        {meal.recipe && <Text style={styles.body}>{([['Proteína',meal.recipe.protein],['Carbohidratos',meal.recipe.carbs],['Grasas',meal.recipe.fat],['Fibra',meal.recipe.fiber]] as const).map(([label,value]) => `${label}: ${typeof value === 'number' && Number.isFinite(value) ? `${value} g` : 'no disponible'}`).join(' · ')}</Text>}
        {meal.recipe?.kind === 'product' && <View style={styles.card}><Text style={styles.heading}>Datos del producto al asignarlo</Text>
          <Text style={styles.body}>Alérgenos reportados: {Array.isArray(meal.recipe.allergens) && meal.recipe.allergens.length ? meal.recipe.allergens.join(', ') : 'sin información disponible'}.</Text>
          <Text style={styles.body}>Trazas reportadas: {Array.isArray(meal.recipe.traces) && meal.recipe.traces.length ? meal.recipe.traces.join(', ') : 'sin información disponible'}.</Text>
          {Array.isArray(meal.recipe.labels) && meal.recipe.labels.length > 0 && <Text style={styles.body}>Etiquetas reportadas: {meal.recipe.labels.join(', ')}.</Text>}
          <Text style={styles.body}>Comprueba la etiqueta actual del producto.</Text></View>}
        {meal.ingredients ? <View style={styles.card}><Text style={styles.heading}>Ingredientes y porciones</Text><Text style={styles.body}>{meal.ingredients}</Text></View> : null}
        {meal.recipe?.ingredients.some(item => item.source_name) && <View style={styles.card}><Text style={styles.heading}>Fuentes de composición</Text>{meal.recipe.ingredients.map(item => <Text key={item.id} style={styles.body}>{item.name}: {item.source_name || 'fuente pendiente de validación'}</Text>)}</View>}
        {meal.notes ? <View style={styles.card}><Text style={styles.heading}>Indicaciones</Text><Text style={styles.body}>{meal.notes}</Text></View> : null}
        {onGroceries && <Action label="Ver despensa y supermercados" onPress={onGroceries} />}
        <Text style={styles.heading}>{mealStatusLabel(meal.status)}</Text>
        {pending.error && <Text accessibilityRole="alert" style={styles.body}>No se pudo leer el registro local. Inténtalo de nuevo al abrir esta comida.</Text>}
        {operation && <View style={styles.card}>
          <Text style={styles.heading}>{operation.conflict ? 'El registro requiere revisión' : 'Registro pendiente de sincronización'}</Text>
          <Text style={styles.body}>Tu elección: {mealStatusLabel(operation.status)}.</Text>
          {operation.conflict && <>
            <Text style={styles.body}>{operation.conflict.reason === 'plan_changed' ? 'Tu profesional modificó esta comida.' : 'El registro cambió desde otro dispositivo.'} Estado actual: {mealStatusLabel(operation.conflict.status)}.</Text>
            <Action label="Descartar mi registro pendiente" disabled={saving} onPress={() => {
              if (!userId) return;
              setSaving(true);
              void discardMealStatusConflict(userId, patientId, operation.id).then(() => {
                setMessage('Registro pendiente descartado. Consulta el estado actualizado antes de volver a elegir.');
                setAttempt(previous => previous + 1);
              }).catch(() => setMessage('No se pudo descartar el registro.')).finally(() => setSaving(false));
            }} />
          </>}
        </View>}
        {meal.meal_date <= mealDate() && <>
          <Action label="Marcar como consumida" disabled={saving || !pending.ready || Boolean(operation) || meal.status === 'CONSUMED' || (Boolean(current.offline) && !statusStorageAvailable)} onPress={() => void record('CONSUMED')} />
          <Action label="Marcar como no consumida" disabled={saving || !pending.ready || Boolean(operation) || meal.status === 'SKIPPED' || (Boolean(current.offline) && !statusStorageAvailable)} onPress={() => void record('SKIPPED')} />
          {current.offline && !statusStorageAvailable && <Text style={styles.body}>Para registrar esta comida, vuelve a conectarte.</Text>}
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
