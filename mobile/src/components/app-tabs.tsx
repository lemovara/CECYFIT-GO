import { Tabs } from 'expo-router';
import { Ionicons } from '@/components/icon';

const items = [
  { name: 'index', title: 'HUB', icon: 'home-outline' as const, active: 'home' as const },
  { name: 'dietas', title: 'Dietas', icon: 'restaurant-outline' as const, active: 'restaurant' as const },
  { name: 'salud', title: 'Salud', icon: 'fitness-outline' as const, active: 'fitness' as const },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline' as const, active: 'person' as const },
];

export default function AppTabs() {
  return (
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#1C4DFF',
      tabBarInactiveTintColor: '#8290A8',
      tabBarStyle: { height: 68, paddingTop: 8, paddingBottom: 8, borderTopColor: '#E5EAF2', backgroundColor: '#FFFFFF' },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    }}>
      {items.map((item) => (
        <Tabs.Screen key={item.name} name={item.name} options={{
          title: item.title,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? item.active : item.icon} size={21} color={color} />,
        }} />
      ))}
      <Tabs.Screen name="pantalla/[slug]" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
