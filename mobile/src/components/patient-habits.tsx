import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mealDate, shiftMealDate } from '@/lib/patient-meals';
import { supabase } from '@/lib/supabase';

type Habit = { id: string; title: string; description: string; goal: string; weekdays: number[]; active: boolean;
  habit_logs: { log_date: string; completed: boolean }[] };
const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function PatientHabits({ patientId }: { patientId: string }) {
  const [habits, setHabits] = useState<Habit[]>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const today = mealDate();
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
  useFocusEffect(useCallback(() => {
    if (!supabase) return;
    void attempt;
    let active = true;
    void supabase.from('patient_habits').select('id,title,description,goal,weekdays,active,habit_logs(log_date,completed)')
      .eq('patient_id', patientId).gte('habit_logs.log_date', shiftMealDate(today, -13))
      .lte('habit_logs.log_date', today).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (active) { if (error) setMessage('No se pudieron cargar tus hábitos.'); else { setHabits(data as Habit[]); setMessage(''); } } });
    return () => { active = false; };
  }, [patientId, attempt, today]));
  async function record(habit: Habit, completed: boolean) {
    if (!supabase || busy) return;
    setBusy(habit.id); setMessage('');
    try {
      const { error } = await supabase.rpc('record_habit', { p_habit_id: habit.id, p_date: today, p_completed: completed });
      if (error) throw error;
      setAttempt(value => value + 1);
    } catch { setMessage('No se pudo guardar. Conéctate y vuelve a intentar.'); }
    finally { setBusy(null); }
  }
  const visible = habits?.filter(habit => habit.active || habit.habit_logs.length > 0);
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.heading}>Mis hábitos</Text>
    {message ? <Text accessibilityRole="alert" style={s.body}>{message} <Text onPress={() => setAttempt(value => value + 1)} style={s.link}>Reintentar</Text></Text> : null}
    {!habits && !message && <Text style={s.body}>Cargando hábitos…</Text>}
    {visible?.length === 0 && <Text style={s.body}>No hay hábitos activos ni registros recientes.</Text>}
    {visible?.map(habit => {
      const todayLog = habit.habit_logs.find(log => log.log_date === today);
      const recent = habit.habit_logs.filter(log => log.log_date >= shiftMealDate(today, -13) && log.log_date <= today)
        .sort((a,b) => b.log_date.localeCompare(a.log_date));
      return <View style={s.card} key={habit.id}>
        <Text style={s.title}>{habit.title}{habit.active ? '' : ' · versión anterior'}</Text>
        {habit.description ? <Text style={s.body}>{habit.description}</Text> : null}
        {habit.goal ? <Text style={s.body}>Meta: {habit.goal}</Text> : null}
        <Text style={s.body}>Días: {habit.weekdays.map(day => days[day-1]).join(', ')}</Text>
        {habit.active && <Text style={s.body}>{habit.weekdays.includes(weekday) ? `Hoy: ${todayLog ? todayLog.completed ? 'cumplido' : 'no cumplido' : 'sin registrar'}` : 'No programado para hoy'}</Text>}
        {habit.active && habit.weekdays.includes(weekday) && <View style={s.row}>{[true, false].map(value => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: todayLog?.completed === value, disabled: busy !== null }} disabled={busy !== null}
          onPress={() => void record(habit, value)} style={[s.button, todayLog?.completed === value && s.selected]}><Text style={s.link}>{value ? 'Cumplí' : 'No cumplí'}</Text></Pressable>)}</View>}
        <Text style={s.body}>Últimos 14 días: {recent.length ? recent.map(log => `${log.log_date}: ${log.completed ? '✓' : 'no'}`).join(' · ') : 'sin registros'}</Text>
      </View>;
    })}
  </View>;
}
const s = StyleSheet.create({ section: { marginTop: 20, gap: 10 }, heading: { fontSize: 19, fontWeight: '800', color: '#1B2A4A' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, gap: 8 }, title: { fontWeight: '800', color: '#1B2A4A' },
  body: { color: '#526580', lineHeight: 20 }, row: { flexDirection: 'row', gap: 8 },
  button: { padding: 10, backgroundColor: '#E7EDFF', borderRadius: 8, borderWidth: 1, borderColor: '#E7EDFF' },
  selected: { borderColor: '#1C4DFF' }, link: { color: '#1C4DFF', fontWeight: '800' } });
