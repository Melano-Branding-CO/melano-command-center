import { lovable } from "@/integrations/lovable/index";

/** Managed Google OAuth returns to a public page before session-based navigation. */
export async function signInWithGoogle(next: "/command" | "/publico" = "/command"): Promise<{ error: Error | null }> {
  const origin = window.location.origin;
  const { error } = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: next === "/publico" ? `${origin}/publico` : `${origin}/auth`,
  });
  return { error: error ?? null };
}
