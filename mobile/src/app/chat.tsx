import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePatient } from '@/lib/patient-session';
import { supabase } from '@/lib/supabase';
type Message = { id: string; body: string; sender_id: string; created_at: string };
export default function Chat() {
  const { patient } = usePatient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState('');
  const pendingSend = useRef<{ patientId: string; text: string; id: string } | null>(null);
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    if (!patient || !supabase) return;
    const sequence = ++requestNumber.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const { data, error: e } = await supabase.from('patient_messages').select('id,body,sender_id,created_at').eq('patient_id', patient.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100).abortSignal(controller.signal);
    clearTimeout(timer);
    if (sequence !== requestNumber.current) return;
    if (e) setError('No se pudieron cargar los mensajes.');
    else { setMessages((data as Message[]).reverse()); setError(''); }
  }, [patient]);
  useFocusEffect(useCallback(() => {
    void refresh();
    if (supabase) void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''));
    const timer = setInterval(() => void refresh(), 10000);
    return () => { requestNumber.current++; clearInterval(timer); };
  }, [refresh]));
  async function send() {
    if (!patient || !supabase || !body.trim() || busy) return;
    setBusy(true); const text = body.trim();
    const entry = pendingSend.current?.patientId === patient.id && pendingSend.current.text === text
      ? pendingSend.current : { patientId: patient.id, text, id: randomUUID() };
    pendingSend.current = entry;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const { error: e } = await supabase.rpc('send_patient_message', { p_id: entry.id, p_patient_id: patient.id, p_body: text }).abortSignal(controller.signal);
      if (e) throw e;
      pendingSend.current = null;
      setBody(current => current.trim() === text ? '' : current);
      await refresh();
    } catch { setError('No se confirmó el envío. Puedes reintentar el mismo mensaje.'); }
    finally { clearTimeout(timer); setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}><Text style={{ fontSize: 24, fontWeight: 'bold' }}>Chat con tu profesional</Text>
    {!patient ? <Text>Vincula tu cuenta para usar el chat.</Text> : <><ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, gap: 10 }}>
      {messages.length === 0 && <Text>Aún no hay mensajes.</Text>}{messages.map(m => <View key={m.id} style={{ padding: 12, backgroundColor: m.sender_id === userId ? '#E7EDFF' : '#F2F4F8', borderRadius: 12 }}><Text style={{ fontWeight: 'bold' }}>{m.sender_id === userId ? 'Tú' : 'Profesional'}</Text><Text>{m.body}</Text><Text>{new Date(m.created_at).toLocaleString('es-MX')}</Text></View>)}
    </ScrollView>{error ? <Text accessibilityRole="alert">{error}</Text> : null}<TextInput accessibilityLabel="Mensaje" value={body} onChangeText={setBody} maxLength={2000} placeholder="Escribe un mensaje" style={{ borderWidth: 1, borderColor: '#ccd6ed', padding: 12, borderRadius: 10 }} /><Button title={busy ? 'Enviando...' : 'Enviar'} disabled={busy || !body.trim()} onPress={() => void send()} /></>}
  </SafeAreaView>;
}
