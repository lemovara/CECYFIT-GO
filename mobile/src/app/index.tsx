import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { usePatient } from '@/lib/patient-session';
import { mealDate, readMeals, type Meal } from '@/lib/patient-meals';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/icon';

const blue = '#1C4DFF';
function Action({ title, subtitle, icon, onPress, color = blue }: { title: string; subtitle: string; icon: string; onPress: () => void; color?: string }) {
  return <Pressable onPress={onPress} style={styles.action}><View style={[styles.icon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={22} color={color} /></View><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color="#98A4B8" /></Pressable>;
}
export default function HomeScreen() {
  const { patient } = usePatient();
  if (patient) return <PatientHub patient={patient} />;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.top}><View><Text style={styles.brand}>CECYFIT <Text style={{ color: '#FF9600' }}>GO!</Text></Text><Text style={styles.greeting}>¡Hola, Ana! 👋</Text><Text style={styles.muted}>Este es tu resumen de hoy.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>AM</Text></View></View>
    <View style={styles.mealCard}><View style={styles.mealBadge}><Ionicons name="restaurant" color="#FFFFFF" size={13}/><Text style={styles.mealBadgeText}>SIGUIENTE COMIDA · 14:30</Text></View><Text style={styles.mealTitle}>Pollo con arroz integral</Text><Text style={styles.mealSub}>520 kcal · Comida principal</Text><Pressable style={styles.primary} onPress={() => router.push({ pathname: '/pantalla/[slug]', params: { slug: 'platillo' } })}><Text style={styles.primaryText}>Ver comida</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF"/></Pressable></View>
    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Tu día</Text><Text style={styles.date}>MIÉRCOLES, 19 NOV</Text></View>
    <View style={styles.grid}><Pressable style={styles.tile} onPress={() => router.push('/salud')}><View style={[styles.tileIcon,{backgroundColor:'#EAF0FF'}]}><Ionicons name="barbell-outline" size={23} color={blue}/></View><Text style={styles.tileTitle}>Tu rutina</Text><Text style={styles.muted}>Tren superior · 35 min</Text><Text style={styles.tileLink}>Ir a rutinas →</Text></Pressable><Pressable style={styles.tile} onPress={() => router.push({ pathname: '/pantalla/[slug]', params: { slug: 'hidratacion' } })}><View style={[styles.tileIcon,{backgroundColor:'#E6F7FF'}]}><Ionicons name="water-outline" size={23} color="#1595D2"/></View><Text style={styles.tileTitle}>Hidratación</Text><Text style={styles.muted}>1.2 de 2.0 litros</Text><Text style={styles.tileLink}>Registrar agua →</Text></Pressable></View>
    <View style={styles.message}><Ionicons name="heart" size={20} color="#F28A26"/><View style={{flex:1}}><Text style={styles.messageTitle}>¡Vas muy bien!</Text><Text style={styles.muted}>La constancia se construye con pequeños pasos. Sigue así.</Text></View></View>
    <Text style={[styles.sectionTitle,{marginTop:22,marginBottom:8}]}>Accesos rápidos</Text>
    <Action title="Mis dietas" subtitle="Comidas, recetas y registro" icon="nutrition-outline" onPress={() => router.push('/dietas')} />
    <Action title="Salud integral" subtitle="Rutinas, hábitos e hidratación" icon="fitness-outline" onPress={() => router.push('/salud')} color="#18A66A" />
    <Action title="Mi perfil" subtitle="Medidas y evolución" icon="person-outline" onPress={() => router.push('/perfil')} color="#F28A26" />
  </ScrollView></SafeAreaView>;
}
function PatientHub({ patient }: { patient: { id: string; full_name: string } }) {
  const [state, setState] = useState<{ meals?: Meal[] }>();
  useFocusEffect(useCallback(() => {
    let active = true;
    void readMeals(patient.id, { date: mealDate() })
      .then((meals) => { if (active) setState({ meals }); })
      .catch(() => { if (active) setState({}); });
    return () => { active = false; };
  }, [patient.id]));
  const now = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const next = state?.meals?.find((meal) => !meal.status && meal.scheduled_time.slice(0, 5) >= now);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.brand}>CECYFIT GO!</Text>
    <Text style={styles.greeting}>¡Hola, {patient.full_name}!</Text>
    <View style={[styles.mealCard, { marginTop: 18 }]}>
      <Text style={styles.mealBadgeText}>SIGUIENTE COMIDA</Text>
      <Text style={styles.mealTitle}>{next?.name ?? (!state ? 'Cargando menú…' : state.meals ? 'Sin más comidas programadas para hoy' : 'Menú no disponible')}</Text>
      {next && <Text style={styles.mealSub}>{next.scheduled_time.slice(0, 5)}</Text>}
      <Pressable style={styles.primary} onPress={() => next ? router.push({ pathname: '/pantalla/[slug]', params: { slug: 'platillo', mealId: next.id } }) : router.navigate('/dietas')}><Text style={styles.primaryText}>{next ? 'Ver comida' : 'Abrir dietas'}</Text></Pressable>
    </View>
    <Action title="Salud integral" subtitle="Rutinas, hábitos e hidratación" icon="fitness-outline" onPress={() => router.navigate('/salud')} color="#18A66A" />
    <Action title="Mi perfil" subtitle="Cuenta vinculada" icon="person-outline" onPress={() => router.navigate('/perfil')} color="#F28A26" />
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#F5F7FB'},content:{padding:20,paddingBottom:30},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:22},brand:{fontSize:13,fontWeight:'900',letterSpacing:1,color:blue},greeting:{fontSize:25,fontWeight:'900',color:'#1B2A4A',marginTop:12},muted:{fontSize:12,color:'#75839A',marginTop:4,lineHeight:18},avatar:{width:44,height:44,borderRadius:22,backgroundColor:'#E7EDFF',alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'900',color:blue},mealCard:{backgroundColor:'#1C4DFF',borderRadius:22,padding:20,marginBottom:24},mealBadge:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',backgroundColor:'#FFFFFF30',paddingHorizontal:10,paddingVertical:6,borderRadius:20},mealBadgeText:{color:'#FFFFFF',fontSize:9,fontWeight:'900',letterSpacing:.5},mealTitle:{fontSize:22,fontWeight:'900',color:'#FFFFFF',marginTop:18},mealSub:{color:'#E1E8FF',fontSize:12,marginTop:5},primary:{backgroundColor:'#FF9600',padding:13,borderRadius:13,marginTop:18,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},primaryText:{color:'#FFFFFF',fontWeight:'900',fontSize:12},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},sectionTitle:{fontSize:17,fontWeight:'900',color:'#1B2A4A'},date:{fontSize:9,fontWeight:'800',color:'#8290A8'},grid:{flexDirection:'row',gap:12},tile:{flex:1,backgroundColor:'#FFFFFF',borderRadius:18,padding:15,borderWidth:1,borderColor:'#E8EDF5'},tileIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',marginBottom:12},tileTitle:{fontSize:14,fontWeight:'900',color:'#1B2A4A'},tileLink:{fontSize:11,fontWeight:'900',color:blue,marginTop:12},message:{marginTop:15,padding:15,backgroundColor:'#FFF7EB',borderRadius:16,flexDirection:'row',alignItems:'center',gap:12},messageTitle:{fontSize:13,fontWeight:'900',color:'#1B2A4A'},action:{backgroundColor:'#FFFFFF',padding:13,borderRadius:15,marginTop:8,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#E8EDF5'},icon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},actionTitle:{fontSize:13,fontWeight:'800',color:'#1B2A4A'}});
