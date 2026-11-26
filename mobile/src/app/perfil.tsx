import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { usePatient } from '@/lib/patient-session';
import { Ionicons } from '@/components/icon';
import { supabase } from '@/lib/supabase';

type Care = { goal: string; restrictions: string; height_cm: number | null; weight_kg: number | null };
export default function Perfil(){
const { patient, closeSession } = usePatient();
const [error, setError] = useState('');
const [care, setCare] = useState<Care | null>();
const patientId = patient?.id;
useFocusEffect(useCallback(() => {
  if (!patientId || !supabase) return;
  let active = true;
  void supabase.from('patient_care_profiles').select('goal,restrictions,height_cm,weight_kg').eq('patient_id', patientId)
    .maybeSingle().then(({ data, error }) => {
      if (active) setCare(error ? null : data);
    });
  return () => { active = false; };
}, [patientId]));
const close = async () => setError(await closeSession() ?? '');
const sessionButton = <><Pressable accessibilityRole="button" style={s.row} onPress={() => void close()}><Text style={s.rowTitle}>{patient ? 'Cerrar sesión' : 'Salir de la demostración'}</Text></Pressable>{error ? <Text accessibilityRole="alert">{error}</Text> : null}</>;
if (patient) return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
  <Text style={s.title}>Mi perfil</Text>
  <View style={s.profile}><Text style={s.name}>{patient.full_name}</Text><Text style={s.sub}>Cuenta vinculada</Text></View>
  <Text style={s.heading}>Mi ingesta</Text>
  <Pressable accessibilityRole="button" style={s.row} onPress={() => router.navigate('/dietas')}>
    <Text style={s.rowTitle}>Registrar una comida de mi dieta</Text>
  </Pressable>
  {care && <>
    <Text style={s.heading}>Mi información nutricional</Text>
    <View style={s.profile}>
      {care.height_cm != null && <Text style={s.sub}>Estatura · {care.height_cm} cm</Text>}
      {care.weight_kg != null && <Text style={s.sub}>Peso · {care.weight_kg} kg</Text>}
      {care.goal ? <Text style={s.sub}>Objetivo · {care.goal}</Text> : null}
      {care.restrictions ? <Text style={s.sub}>Restricciones · {care.restrictions}</Text> : null}
    </View>
  </>}
  {sessionButton}
</ScrollView></SafeAreaView>;
return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>CECYFIT GO! · PACIENTE</Text><Text style={s.title}>Mi perfil</Text><View style={s.profile}><View style={s.avatar}><Text style={s.initials}>AM</Text></View><Text style={s.name}>Ana Martínez</Text><Text style={s.sub}>Paciente · Plan de bienestar integral</Text></View><Text style={s.heading}>Mis indicadores</Text><View style={s.metrics}>{[['Peso','68.4','kg'],['Altura','1.65','m'],['IMC','25.1','']].map(([a,b,c])=><View key={a} style={s.metric}><Text style={s.sub}>{a}</Text><Text style={s.value}>{b} <Text style={s.unit}>{c}</Text></Text></View>)}</View><Text style={s.heading}>Mi información</Text>{[['heart-outline','Condiciones de salud','Hipotiroidismo'],['nutrition-outline','Restricciones','Sin lácteos'],['person-outline','Mi nutrióloga','Dra. Reyes'],['stats-chart-outline','Mi evolución','Consultar historial'],['settings-outline','Preferencias','Notificaciones e idioma']].map(([ic,a,b])=><Pressable key={a} style={s.row} accessibilityRole="button" onPress={() => router.push({ pathname: '/pantalla/[slug]', params: { slug: a === 'Mi evolución' ? 'evolucion' : a === 'Preferencias' ? 'preferencias' : 'perfil', detalle: a, resumen: b } })}><Ionicons name={ic} size={20} color="#1C4DFF"/><View style={{flex:1}}><Text style={s.rowTitle}>{a}</Text><Text style={s.sub}>{b}</Text></View><Ionicons name="chevron-forward" size={17} color="#9AA6B8"/></Pressable>)}<Text style={s.disclaimer}>Perfil de demostración · Los datos son ilustrativos.</Text>{sessionButton}</ScrollView></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FB'},content:{padding:20,paddingBottom:35},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#1C4DFF'},title:{fontSize:27,fontWeight:'900',color:'#1B2A4A',marginTop:9},profile:{alignItems:'center',backgroundColor:'#FFF',padding:22,borderRadius:18,marginTop:20,borderWidth:1,borderColor:'#E8EDF5'},avatar:{width:68,height:68,borderRadius:34,backgroundColor:'#E7EDFF',alignItems:'center',justifyContent:'center'},initials:{fontSize:20,fontWeight:'900',color:'#1C4DFF'},name:{fontSize:17,fontWeight:'900',color:'#1B2A4A',marginTop:10},sub:{fontSize:11,color:'#75839A',marginTop:4},heading:{fontSize:16,fontWeight:'900',color:'#1B2A4A',marginTop:22,marginBottom:10},metrics:{flexDirection:'row',gap:9},metric:{flex:1,backgroundColor:'#FFF',padding:13,borderRadius:14,borderWidth:1,borderColor:'#E8EDF5'},value:{fontSize:20,fontWeight:'900',color:'#1B2A4A',marginTop:6},unit:{fontSize:10,color:'#75839A'},row:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFF',padding:14,borderRadius:14,marginBottom:8,borderWidth:1,borderColor:'#E8EDF5'},rowTitle:{fontSize:12,fontWeight:'900',color:'#1B2A4A'},disclaimer:{fontSize:10,color:'#8290A8',textAlign:'center',marginTop:16}});
