import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@/lib/supabase';

const invitationPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function PatientAccess({ pending, signedIn, error, onRetry, onDemo, onSignOut }: {
  pending: boolean;
  signedIn: boolean;
  error?: string;
  onRetry: () => void;
  onDemo: () => void;
  onSignOut: () => Promise<string | null>;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  async function openScanner() {
    setMessage('');
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (permission.granted) setScanning(true);
    else setMessage('Puedes escribir el código o dar permiso a la cámara en los ajustes de tu dispositivo.');
  }

  async function authenticate() {
    if (!supabase || busy) return;
    const address = email.trim();
    if (!address || !password || (register && !name.trim())) {
      setMessage('Completa los campos para continuar.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (register) {
        const { data, error: failure } = await supabase.auth.signUp({
          email: address, password, options: { data: { full_name: name.trim() } },
        });
        if (failure) {
          setMessage('No pudimos crear tu cuenta. Revisa el correo y los requisitos de contraseña.');
        } else if (!data.session) {
          setRegister(false);
          setMessage('Confirma tu correo y luego vuelve a la app para iniciar sesión.');
        }
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: address, password });
        if (failure) setMessage('No pudimos iniciar sesión. Revisa tus datos y la confirmación de tu correo.');
      }
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!supabase || busy) return;
    const token = code.trim();
    if (!invitationPattern.test(token)) {
      setMessage('Escribe el código completo que te entregó tu profesional.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error: failure } = await supabase.rpc('redeem_patient_invitation', { invitation_token: token });
      if (failure) setMessage('Esta invitación no está disponible para tu cuenta. Pide a tu profesional un código vigente y verifica tu correo.');
      else {
        setCode('');
        onRetry();
      }
    } finally {
      setBusy(false);
    }
  }

  if (pending) return <SafeAreaView style={styles.loading}><ActivityIndicator accessibilityLabel="Comprobando sesión" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.brand}>CECYFIT GO!</Text>
        <Text style={styles.title}>{signedIn ? 'Vincula tu cuenta' : register ? 'Crea tu cuenta' : 'Acceso de paciente'}</Text>
        {signedIn ? (
          <>
            {error ? <Text style={styles.message}>{error}</Text> : <>
              <Text style={styles.body}>Ingresa el código que te entregó tu profesional.</Text>
              <TextInput accessibilityLabel="Código de invitación" style={styles.input} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="Código de invitación" />
              {scanning ? <>
                <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => {
                  const value = data.trim();
                  if (invitationPattern.test(value)) {
                    setCode(value);
                    setScanning(false);
                  }
                }} />
                <Action label="Cerrar cámara" secondary onPress={() => setScanning(false)} />
              </> : <Action label="Escanear QR" secondary disabled={busy} onPress={() => void openScanner()} />}
              <Action label="Vincular cuenta" disabled={busy} onPress={() => void redeem()} />
            </>}
            {error && <Action label="Volver a comprobar" onPress={onRetry} />}
            <Action label="Cerrar sesión" secondary disabled={busy} onPress={async () => {
              setMessage(await onSignOut() ?? '');
            }} />
          </>
        ) : (
          <>
            {supabase ? <>
              {register && <TextInput accessibilityLabel="Nombre completo" style={styles.input} value={name} onChangeText={setName} autoComplete="name" placeholder="Nombre completo" />}
              <TextInput accessibilityLabel="Correo electrónico" style={styles.input} value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" keyboardType="email-address" placeholder="Correo electrónico" />
              <TextInput accessibilityLabel="Contraseña" style={styles.input} value={password} onChangeText={setPassword} autoComplete={register ? 'new-password' : 'current-password'} secureTextEntry placeholder="Contraseña" />
              <Action label={register ? 'Crear cuenta' : 'Iniciar sesión'} disabled={busy} onPress={() => void authenticate()} />
              <Action secondary label={register ? 'Ya tengo una cuenta' : 'Crear cuenta de paciente'} disabled={busy} onPress={() => {
                setRegister(!register);
                setMessage('');
              }} />
            </> : <Text style={styles.body}>Configura Supabase para acceder con tu cuenta.</Text>}
            <Action secondary label="Entrar a la demostración" disabled={busy} onPress={onDemo} />
          </>
        )}
        {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress, secondary, disabled }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <View><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14, width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { color: '#1C4DFF', fontSize: 14, fontWeight: '900' },
  title: { color: '#1B2A4A', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  body: { color: '#566783', lineHeight: 20 },
  input: { backgroundColor: '#FFFFFF', color: '#1B2A4A', borderRadius: 12, borderWidth: 1, borderColor: '#D6DDEB', padding: 14 },
  button: { alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#1C4DFF' },
  secondary: { backgroundColor: '#E7EDFF' },
  camera: { height: 220, borderRadius: 12, overflow: 'hidden' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryText: { color: '#1C4DFF' },
  message: { color: '#843828', lineHeight: 20 },
});
