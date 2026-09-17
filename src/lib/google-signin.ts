import { supabase } from "@/integrations/supabase/client";

/** Google OAuth through the canonical Supabase project on every environment. */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const origin = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/command` },
  });
  return { error: error ?? null };
}
