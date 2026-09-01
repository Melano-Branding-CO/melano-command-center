import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in through the canonical Supabase Auth project.
 *
 * We intentionally avoid the Lovable OAuth broker here so preview, custom
 * domain and production use the same provider configuration and callback.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const origin = window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/command`,
    },
  });

  return { error: error ?? null };
}
