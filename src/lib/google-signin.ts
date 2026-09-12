import { supabase } from "@/integrations/supabase/client";

const NEXT_KEY = "melano:auth:next";
const DEFAULT_TARGET = "/command";
const LOCAL_BASE = "https://melano.local";

export function normalizePostLoginTarget(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_TARGET;
  }

  try {
    const url = new URL(value, LOCAL_BASE);
    if (url.origin !== LOCAL_BASE) return DEFAULT_TARGET;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_TARGET;
  }
}

export async function signInWithGoogle(next?: string): Promise<{ error: Error | null }> {
  const target = normalizePostLoginTarget(next);

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
    sessionStorage.removeItem(NEXT_KEY);
    return normalizePostLoginTarget(value ?? undefined);
  } catch {
    return DEFAULT_TARGET;
  }
}
