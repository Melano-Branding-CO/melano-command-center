import { supabase } from "@/integrations/supabase/client";

const NEXT_KEY = "melano:auth:next";

export async function signInWithGoogle(next?: string): Promise<{ error: Error | null }> {
  const target = next && /^\/(?!\/)/.test(next) ? next : "/command";

  try {
    sessionStorage.setItem(NEXT_KEY, target);
  } catch {
    // sessionStorage puede no estar disponible; el fallback es /command.
  }

  const callbackUrl = new URL("/auth", window.location.origin);
  callbackUrl.searchParams.set("next", target);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
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
