
"use client";

import {
  createContext,
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase/clients";

type AuthGateProps = {
  children: ReactNode;
};

export const HostDemoContext = createContext<(() => void) | null>(null);

export default function AuthGate({ children }: AuthGateProps) {
  const [userId, setUserId] = useState<string | null | undefined>(
    hasSupabaseConfig ? undefined : null,
  );
  const [verification, setVerification] = useState<{
    userId: string;
    attempt: number;
    result: "allowed" | "denied" | "error";
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // 1. Escuchar los cambios de sesión sin consultar otras tablas
  // dentro del callback de autenticación.
  useEffect(() => {
    if (!hasSupabaseConfig) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Comprobar el rol fuera del callback de autenticación.
  useEffect(() => {
    if (!userId) return;
    const id = userId;
    let active = true;

    async function verifyProfessional() {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", id)
        .maybeSingle();

      if (!active) return;

      setVerification({
        userId: id,
        attempt,
        result: error ? "error" : profile?.role === "PROFESIONAL" ? "allowed" : "denied",
      });
    }

    void verifyProfessional();

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const access = userId === undefined ? "loading"
    : userId === null ? "signed-out"
    : verification?.userId === userId && verification.attempt === attempt
      ? verification.result : "loading";

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSupabaseConfig) return;
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Escribe tu correo y contraseña.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage("No se pudo iniciar sesión. Verifica tus datos.");
      setSaving(false);
      return;
    }

    setPassword("");
    setSaving(false);
  }

  if (demoMode) {
    return <HostDemoContext.Provider value={() => setDemoMode(false)}>{children}</HostDemoContext.Provider>;
  }

  if (access === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fc] p-6">
        <p className="text-sm font-bold text-[#1b2a4a]">
          Comprobando acceso...
        </p>
      </main>
    );
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fc] p-5">
        <section className="w-full max-w-md rounded-3xl border-2 border-[#1b2a4a] bg-white p-7 shadow-[5px_5px_0_#1b2a4a]">
          <p className="text-sm font-black text-[#1c4dff]">
            CECYFIT <span className="text-[#ff9600]">GO!</span>
          </p>

          <h1 className="mt-5 text-2xl font-black text-[#1b2a4a]">
            Acceso profesional
          </h1>

          <p className="mt-2 text-sm text-[#6b7a96]">
            Inicia sesión para entrar al panel HOST.
          </p>

          {access === "error" || access === "denied" ? (
            <div className="mt-6 space-y-3">
              <p role="alert" className="text-sm text-red-700">
                {access === "error"
                  ? "No se pudo comprobar el perfil profesional."
                  : "Esta cuenta no tiene acceso al panel profesional."}
              </p>
              {access === "error" && <button type="button" className="mr-4 underline" onClick={() => setAttempt(attempt + 1)}>Reintentar</button>}
              <button type="button" className="underline" onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) setMessage("No se pudo cerrar la sesión.");
                else setVerification(null);
              }}>Usar otra cuenta</button>
              {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
            </div>
          ) : <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold">
                Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border-2 border-[#e1e7f2] px-4 py-3 text-sm outline-none focus:border-[#1c4dff]"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-[#e1e7f2] px-4 py-3 text-sm outline-none focus:border-[#1c4dff]"
                placeholder="Tu contraseña"
              />
            </div>

            {(message || !hasSupabaseConfig) && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
              >
                {message || "Configura Supabase para iniciar sesión."}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !hasSupabaseConfig}
              className="w-full rounded-xl border-2 border-[#1b2a4a] bg-[#1c4dff] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {saving ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>}

          <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-[#9aa6b8]">
            <span className="h-px flex-1 bg-[#e1e7f2]" />
            o
            <span className="h-px flex-1 bg-[#e1e7f2]" />
          </div>
          <button
            type="button"
            onClick={() => setDemoMode(true)}
            className="w-full rounded-xl border-2 border-[#1b2a4a] bg-[#18a66a] px-4 py-3 text-sm font-black text-white"
          >
            Entrar en modo demostración
          </button>
          <p className="mt-3 text-center text-[10px] leading-4 text-[#8290a8]">
            Acceso temporal con información ficticia. No se guardarán cambios en la base de datos.
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>
}
