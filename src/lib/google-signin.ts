import { lovable } from "@/integrations/lovable";
import { oauthReturnPath } from "./oauth-return-path";

/** Return to a public page; the login page navigates after session hydration. */
export async function signInWithGoogle(next = "/command"): Promise<{ error: Error | null }> {
  const target = oauthReturnPath(next);
  const returnPath = target === "/publico" ? "/publico" : `/auth?next=${encodeURIComponent(target)}`;
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: new URL(returnPath, window.location.origin).href,
  });
  return { error: result.error ?? null };
}
