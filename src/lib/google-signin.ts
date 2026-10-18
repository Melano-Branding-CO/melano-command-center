import { lovable } from "@/integrations/lovable";

/** Return to a public page; the login page navigates after session hydration. */
export async function signInWithGoogle(next: "/command" | "/publico" = "/command"): Promise<{ error: Error | null }> {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: `${window.location.origin}${next === "/publico" ? "/publico" : "/auth"}`,
  });
  return { error: result.error ?? null };
}
