import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mealDate, mealSaveError, readExtraMeals, saveExtraMeal, type ExtraMeal } from '@/lib/patient-meals';

export function PatientExtraMeals({ patientId, day, onBack, backLabel = 'Volver a Dietas' }: {
  patientId: string; day: string; onBack: () => void; backLabel?: string;
}) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [calories, setCalories] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; entries?: ExtraMeal[] }>();
  const request = useRef<ExtraMeal | null>(null);
  const inFlight = useRef(false);
  const current = result?.attempt === attempt ? result : undefined;
  const canAdd = day <= mealDate();

  useFocusEffect(useCallback(() => {
    let active = true;
    void readExtraMeals(patientId, day)
      .then((entries) => { if (active) setResult({ attempt, entries }); })
      .catch(() => { if (active) setResult({ attempt }); });
    return () => { active = false; };
  }, [patientId, day, attempt]));

  async function save() {
    if (!canAdd || inFlight.current) return;
    const dish = name.trim();
    const amount = portion.trim();
    const kcal = calories.trim() ? Number(calories) : null;
    setMessage('');
    setError('');
    if (!dish || !amount) {
      setError('Escribe el alimento y la cantidad consumida.');
      return;
    }
    if (kcal !== null && (!/^\d+$/.test(calories.trim()) || !Number.isInteger(kcal) || kcal > 10000)) {
      setError('Escribe las calorías como un número entero entre 0 y 10 000.');
      return;
    }
    const previous = request.current;
    const sameRequest = previous?.name === dish && previous.portion === amount && previous.kcal === kcal;
    inFlight.current = true;
    setSaving(true);
    try {
      const entry = sameRequest ? previous : { id: randomUUID(), name: dish, portion: amount, kcal };
      request.current = entry;
      await saveExtraMeal(patientId, day, entry);
      request.current = null;
      setName('');
      setPortion('');
      setCalories('');
      setMessage('Consumo guardado.');
      setAttempt((value) => value + 1);
    } catch (error) {
      setError(mealSaveError(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const dateLabel = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full', timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.link}>{backLabel}</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Comidas fuera del plan</Text>
      <Text style={styles.body}>{dateLabel}</Text>
      {canAdd && <View style={styles.card}>
        <Text style={styles.body}>Comparte lo que comiste para que tu profesional pueda revisarlo en el seguimiento.</Text>
        <Text style={styles.heading}>Alimento o platillo</Text>
        <TextInput accessibilityLabel="Alimento o platillo" value={name} onChangeText={setName}
          placeholder="Ej. Tacos de frijol" maxLength={120} editable={!saving} style={styles.input} />
        <Text style={styles.heading}>Cantidad consumida</Text>
        <TextInput accessibilityLabel="Cantidad consumida" value={portion} onChangeText={setPortion}
          placeholder="Ej. 2 piezas" maxLength={120} editable={!saving} style={styles.input} />
        <Text style={styles.heading}>Calorías (opcional)</Text>
        <TextInput accessibilityLabel="Calorías" value={calories} onChangeText={setCalories}
          keyboardType="number-pad" maxLength={5} editable={!saving} style={styles.input} />
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.disabled]}>
          <Text style={styles.buttonText}>{saving ? 'Guardando…' : 'Guardar consumo'}</Text>
        </Pressable>
      </View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
      <Text accessibilityRole="header" style={styles.heading}>Registros de este día</Text>
      {!current && <ActivityIndicator accessibilityLabel="Cargando registros" />}
      {current && !current.entries && <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>No pudimos cargar los registros.</Text>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}><Text style={styles.link}>Reintentar</Text></Pressable>
      </View>}
      {current?.entries?.length === 0 && <Text style={styles.body}>Aún no hay registros para este día.</Text>}
      {current?.entries?.map((entry) => <View key={entry.id} style={styles.card}>
        <Text style={styles.heading}>{entry.name}</Text>
        <Text style={styles.body}>{entry.portion}{entry.kcal !== null ? ` · ${entry.kcal} kcal` : ''}</Text>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  title: { color: '#1B2A4A', fontSize: 27, fontWeight: '900' },
  heading: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  body: { color: '#526580', lineHeight: 20 },
  error: { color: '#9C3D35', lineHeight: 20 },
  link: { color: '#1C4DFF', fontWeight: '800', paddingVertical: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderColor: '#D6DDEB', borderRadius: 10, color: '#1B2A4A', padding: 12 },
  button: { backgroundColor: '#1C4DFF', borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
