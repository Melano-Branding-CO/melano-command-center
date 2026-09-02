import { lovable } from "@/integrations/lovable/index";

const NEXT_KEY = "melano:auth:next";

/**
 * Google sign-in a través del proveedor administrado de Lovable Cloud.
 *
 * El destino se guarda aparte y se aplica recién cuando la sesión de Supabase
 * está confirmada, nunca como redirect_uri hacia una ruta protegida.
 */
export async function signInWithGoogle(next?: string): Promise<{ error: Error | null }> {
  const target = next && /^\/(?!\/)/.test(next) ? next : "/command";

  try {
    sessionStorage.setItem(NEXT_KEY, target);
  } catch {
    // sessionStorage puede no estar disponible; el fallback es /command.
  }

  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: `${window.location.origin}/auth`,
    extraParams: { prompt: "select_account" },
  });

  if (result.error) return { error: result.error };
  return { error: null };
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
