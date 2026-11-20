import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { isAuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const invitationPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resendDelay = 60_000;

type AccessMode = 'login' | 'register' | 'confirm';

function authMessage(error: unknown, fallback: string) {
  if (!isAuthError(error)) return fallback;
  if (error.code === 'over_email_send_rate_limit') return 'Se alcanzó el límite de correos. Espera antes de solicitar otro.';
  if (error.status === 429) return 'Hubo demasiados intentos seguidos. Espera un momento y vuelve a intentar.';
  if (error.code === 'email_address_not_authorized') return 'El servicio de correo todavía no admite esta dirección. Contacta al administrador de CECYFIT GO.';
  if (error.code === 'otp_expired') return 'El código caducó o ya se usó. Solicita uno nuevo.';
  if (error.code === 'weak_password') return 'Usa una contraseña que cumpla los requisitos de seguridad.';
  if (error.code === 'invalid_credentials') return 'Verifica el correo y la contraseña.';
  if (error.name === 'AuthRetryableFetchError') return 'No pudimos conectar. Revisa tu conexión y vuelve a intentar.';
  return fallback;
}

export function PatientAccess({ pending, signedIn, error, onRetry, onDemo, onSignOut }: {
  pending: boolean;
  signedIn: boolean;
  error?: string;
  onRetry: () => void;
  onDemo: () => void;
  onSignOut: () => Promise<string | null>;
}) {
  const [mode, setMode] = useState<AccessMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (!resendAvailableAt) return;
    const timer = setTimeout(() => setResendAvailableAt(0), Math.max(0, resendAvailableAt - Date.now()));
    return () => clearTimeout(timer);
  }, [resendAvailableAt]);

  function switchMode(next: AccessMode) {
    setMode(next);
    setMessage('');
    setEmailCode('');
    if (next !== 'confirm') setPassword('');
  }

  async function openScanner() {
    setMessage('');
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (permission.granted) setScanning(true);
    else setMessage('Puedes escribir el código o dar permiso a la cámara en los ajustes de tu dispositivo.');
  }

  async function runRequest(action: () => Promise<void>, fallback: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(authMessage(error, fallback));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function authenticate() {
    const client = supabase;
    if (!client) return;
    const address = email.trim();
    if (!emailPattern.test(address)) {
      setMessage('Escribe un correo electrónico válido.');
      return;
    }
    if (!password || (mode === 'register' && !name.trim())) {
      setMessage('Completa los campos para continuar.');
      return;
    }
    await runRequest(async () => {
      if (mode === 'register') {
        const { data, error: failure } = await client.auth.signUp({
          email: address, password, options: { data: { full_name: name.trim() } },
        });
        if (failure) throw failure;
        if (!data.session) {
          switchMode('confirm');
          setResendAvailableAt(Date.now() + resendDelay);
        }
      } else {
        const { error: failure } = await client.auth.signInWithPassword({ email: address, password });
        if (failure?.code === 'email_not_confirmed') {
          switchMode('confirm');
          setMessage('Todavía falta confirmar tu correo electrónico.');
          return;
        }
        if (failure) throw failure;
      }
    }, mode === 'register' ? 'No pudimos crear tu cuenta. Vuelve a intentar.' : 'No pudimos iniciar sesión. Revisa tus datos.');
  }

  async function verifyEmail() {
    const client = supabase;
    if (!client) return;
    if (!/^\d{6,10}$/.test(emailCode)) {
      setMessage('Escribe el código completo de tu correo.');
      return;
    }
    await runRequest(async () => {
      const { data, error: failure } = await client.auth.verifyOtp({ email: email.trim(), token: emailCode, type: 'email' });
      if (failure) throw failure;
      if (!data.session) {
        switchMode('login');
        setMessage('Correo confirmado. Inicia sesión para vincular la cuenta.');
      }
    }, 'No pudimos confirmar el código. Comprueba que sea el más reciente.');
  }

  async function resendEmail() {
    const client = supabase;
    if (!client || resendAvailableAt) return;
    await runRequest(async () => {
      const { error: failure } = await client.auth.resend({ email: email.trim(), type: 'signup' });
      if (!failure || failure.status === 429) setResendAvailableAt(Date.now() + resendDelay);
      if (failure) throw failure;
      setEmailCode('');
      setMessage('Solicitaste un nuevo correo. Usa el código más reciente.');
    }, 'No pudimos reenviar el correo. Intenta de nuevo.');
  }

  async function redeem() {
    if (!supabase || busy) return;
    const token = code.trim();
    if (!invitationPattern.test(token)) {
      setMessage('Escribe el código completo que te entregó tu profesional.');
      return;
    }
    const client = supabase;
    await runRequest(async () => {
      const { error: failure } = await client.rpc('redeem_patient_invitation', { invitation_token: token });
      if (failure) setMessage('Esta invitación no está disponible para tu cuenta. Pide a tu profesional un código vigente y verifica tu correo.');
      else {
        setCode('');
        onRetry();
      }
    }, 'No pudimos conectar para vincular tu cuenta.');
  }

  if (pending) return <SafeAreaView style={styles.loading}><ActivityIndicator accessibilityLabel="Comprobando sesión" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.brand}>CECYFIT GO!</Text>
        <Text accessibilityRole="header" style={styles.title}>{signedIn ? 'Vincula tu cuenta' : mode === 'confirm' ? 'Confirma tu correo' : mode === 'register' ? 'Crea tu cuenta' : 'Acceso de paciente'}</Text>
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
        ) : mode === 'confirm' ? (
          <>
            <Text style={styles.body}>Revisa tu correo y la carpeta de spam en {email.trim()}.</Text>
            <Text style={styles.body}>Si recibiste un código, escríbelo aquí para confirmar desde la app.</Text>
            <TextInput accessibilityLabel="Código de correo" style={styles.input} value={emailCode} onChangeText={(value) => setEmailCode(value.replace(/\D/g, ''))} maxLength={10} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy} placeholder="Código de correo" />
            <Action label="Confirmar código" disabled={busy} onPress={() => void verifyEmail()} />
            <Action secondary label={resendAvailableAt ? 'Reenviar correo (espera un momento)' : 'Reenviar correo'} disabled={busy || Boolean(resendAvailableAt)} onPress={() => void resendEmail()} />
            <Action secondary label="Ya confirmé con el enlace" disabled={busy} onPress={() => {
              if (password) void authenticate();
              else switchMode('login');
            }} />
            <Action secondary label="Cambiar de correo" disabled={busy} onPress={() => switchMode('register')} />
          </>
        ) : (
          <>
            {supabase ? <>
              {mode === 'register' && <TextInput accessibilityLabel="Nombre completo" style={styles.input} value={name} onChangeText={setName} autoComplete="name" editable={!busy} placeholder="Nombre completo" />}
              <TextInput accessibilityLabel="Correo electrónico" style={styles.input} value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!busy} placeholder="Correo electrónico" />
              <TextInput accessibilityLabel="Contraseña" style={styles.input} value={password} onChangeText={setPassword} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} secureTextEntry editable={!busy} placeholder="Contraseña" />
              <Action label={busy ? 'Procesando…' : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'} disabled={busy} onPress={() => void authenticate()} />
              <Action secondary label={mode === 'register' ? 'Ya tengo una cuenta' : 'Crear cuenta de paciente'} disabled={busy} onPress={() => switchMode(mode === 'register' ? 'login' : 'register')} />
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
