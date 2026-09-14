import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

/**
 * Google sign-in that works on every hosting domain.
 *
 * On *.lovable.app the Lovable proxy intercepts /~oauth/*, so the managed
 * broker flow works. On self-hosted domains (workers.dev, custom domains
 * served by our own Worker) that interception does not exist, so we use
 * Supabase's native OAuth flow instead — same managed Google credentials,
 * callback handled by Supabase Auth, session restored from the URL hash.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const origin = window.location.origin;
  const isLovableHosted =
    origin.endsWith(".lovable.app") || origin.includes("localhost");

  if (isLovableHosted) {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: origin,
    });
    return { error: result.error ?? null };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/command` },
  });
  return { error: error ?? null };
}
