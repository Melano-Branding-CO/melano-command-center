import { supabase } from "@/integrations/supabase/client";

const NEXT_KEY = "melano:auth:next";

/**
 * Google sign-in mediante Supabase Auth canónico.
 *
 * Google vuelve al callback del proyecto Supabase y Supabase redirige después
 * a /auth en el mismo origen. El destino final se guarda aparte para evitar
 * usar una ruta protegida como callback del proveedor.
 */
export async function signInWithGoogle(next?: string): Promise<{ error: Error | null }> {
  const target = next && /^\/(?!\/)/.test(next) ? next : "/command";

  try {
    sessionStorage.setItem(NEXT_KEY, target);
  } catch {
    // sessionStorage puede no estar disponible; el fallback es /command.
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth`,
      queryParams: { prompt: "select_account" },
    },
  });

  return { error };
}

export function takePostLoginTarget(): string {
  try {
    const value = sessionStorage.getItem(NEXT_KEY);
    if (value) {
      sessionStorage.removeItem(NEXT_KEY);
      if (/^\/(?!\/)/.test(value)) return value;
    }
  } catch {
    // ignorado
  }
  return "/command";
}
