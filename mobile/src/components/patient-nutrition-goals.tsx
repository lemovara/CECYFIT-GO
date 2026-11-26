import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { usePatient } from '@/lib/patient-session';
import { loadNutritionGoal, NutritionGoalNetworkError, type NutritionGoal } from '@/lib/nutrition-goal-cache-core';
import { nutritionGoalCache } from '@/lib/nutrition-goal-cache';
import { withRequestTimeout } from '@/lib/request-timeout';
import type { summarizeConfirmedIntake } from '@/lib/meal-day-summary';

export function PatientNutritionGoals({ patientId, day, intake, planOffline }: { patientId: string; day: string; intake?: ReturnType<typeof summarizeConfirmedIntake>; planOffline?: boolean }) {
  const { userId } = usePatient();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ user: string; patient: string; day: string; attempt: number; goal: NutritionGoal | null; error?: boolean; offline?: boolean; savedAt?: string }>();
  useFocusEffect(useCallback(() => {
    if (!supabase || !userId) return;
    let active = true;
    const client = supabase;
    const fetchGoal = async () => {
      const { data,error,status } = await withRequestTimeout(signal => client.from('patient_nutrition_goals').select('effective_on,kcal,protein,carbs,fat,fiber')
        .eq('patient_id',patientId).lte('effective_on',day).order('effective_on',{ ascending:false })
        .order('created_at',{ ascending:false }).order('id',{ ascending:false }).limit(1).abortSignal(signal).maybeSingle());
      if (error) { if (status === 0) throw new NutritionGoalNetworkError('Sin conexión'); throw error; }
      return data as NutritionGoal | null;
    };
    void loadNutritionGoal(nutritionGoalCache,userId,patientId,day,fetchGoal)
      .then(value => { if (active) setResult({ user:userId,patient:patientId,day,attempt,...value }); })
      .catch(() => { if (active) setResult({ user:userId,patient:patientId,day,attempt,goal:null,error:true }); });
    return () => { active = false; };
  }, [patientId,day,attempt,userId]));
  const current = result?.user === userId && result.patient === patientId && result.day === day && result.attempt === attempt ? result : undefined;
  return <View style={s.card}><Text accessibilityRole="header" style={s.title}>Metas de tu profesional</Text>
    {!current && <Text style={s.body}>Cargando metas…</Text>}
    {current?.error && <><Text style={s.body}>No se pudieron consultar las metas.</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={s.link}>Reintentar</Text></Pressable></>}
    {current?.offline && <Text style={s.body}>Sin conexión: metas guardadas el {new Date(current.savedAt!).toLocaleString('es-MX')}. El profesional podría haberlas cambiado.</Text>}
    {current && !current.error && !current.goal && <Text style={s.body}>No hay metas establecidas para este día.</Text>}
    {current?.goal && <><Text style={s.body}>Vigentes desde {current.goal.effective_on}.</Text>
      {([['Energía',current.goal.kcal,'kcal'],['Proteína',current.goal.protein,'g'],['Carbohidratos',current.goal.carbs,'g'],['Grasas',current.goal.fat,'g'],['Fibra',current.goal.fiber,'g']] as const).map(([label,value,unit]) => <Text key={label} style={s.body}>{label}: {value == null ? 'no definida' : `${value} ${unit}`}</Text>)}
      {intake && intake.mealsAvailable && intake.extrasAvailable && intake.pendingCount === 0 && !planOffline && !current.offline && <>
        <Text style={s.body}>Comparación con el consumo confirmado:</Text>
        {([['kcal','Energía','kcal'],['protein','Proteína','g'],['carbs','Carbohidratos','g'],['fat','Grasas','g'],['fiber','Fibra','g']] as const).map(([key,label,unit]) => {
          const target = current.goal?.[key];
          const total = intake.totals[key];
          if (target == null) return null;
          return <Text key={key} style={s.body}>{label}: {total.missing ? 'comparación no disponible: faltan datos nutricionales' : `${total.known.toFixed(1)} de ${target} ${unit}`}</Text>;
        })}
      </>}
      {intake && (!intake.mealsAvailable || !intake.extrasAvailable || intake.pendingCount > 0 || planOffline || current.offline) && <Text style={s.body}>La comparación con el consumo estará disponible cuando se verifiquen y sincronicen los registros.</Text>}
    </>}
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor:'#fff',borderRadius:12,padding:12,gap:6 },
  title:{ color:'#1B2A4A',fontWeight:'800' },body:{ color:'#526580',lineHeight:20 },link:{ color:'#1C4DFF',fontWeight:'800' } });
