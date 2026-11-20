import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// El cliente de demostración evita que la aplicación falle al cargar cuando
// todavía no se han configurado las variables locales. No habilita acceso real.
export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl || "https://demo-placeholder.supabase.co",
  supabasePublishableKey || "demo-placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
