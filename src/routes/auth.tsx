import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizePostLoginTarget,
  signInWithGoogle,
  takePostLoginTarget,
} from "@/lib/google-signin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso — MELANO INC Command Center" },
      {
        name: "description",
        content:
          "Acceso privado al Autonomous Command Center de MELANO INC con email o cuenta de Google.",
      },
      { property: "og:title", content: "Acceso — MELANO INC Command Center" },
      {
        property: "og:description",
        content: "Ingresá al Command Center autónomo de MELANO INC.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string; code?: string; error?: string; error_description?: string } => {
    const rawNext = typeof search["next"] === "string" ? search["next"] : "";
    const result: {
      next?: string;
      code?: string;
      error?: string;
      error_description?: string;
    } = {};

    if (rawNext && /^\/(?!\/)/.test(rawNext) && !rawNext.includes("\\")) {
      result.next = normalizePostLoginTarget(rawNext);
    }
    if (typeof search["code"] === "string") result.code = search["code"];
    if (typeof search["error"] === "string") result.error = search["error"];
    if (typeof search["error_description"] === "string") {
      result.error_description = search["error_description"];
    }
    return result;
  },
  component: AuthRoute,
});

function AuthRoute() {
  const search = Route.useSearch();
  return <AuthPage {...search} />;
}

export function AuthPage({
  next,
  code,
  error: oauthError,
  error_description: oauthErrorDescription,
}: {
  next?: string;
  code?: string;
  error?: string;
  error_description?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(Boolean(code || oauthError));
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    let active = true;

    const go = () => {
      // Consume the stored target on every completed auth flow so it cannot
      // leak into a later login. The callback target wins when present.
      const storedTarget = takePostLoginTarget();
      const target = normalizePostLoginTarget(next ?? storedTarget);
      window.location.replace(target);
    };

    const restoreSession = async () => {
      try {
        if (oauthError) {
          throw new Error(oauthErrorDescription || oauthError);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Remove one-time OAuth params immediately after a successful exchange.
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          cleanUrl.searchParams.delete("error");
          cleanUrl.searchParams.delete("error_description");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (active && data.session) {
          go();
          return;
        }
      } catch (err) {
        if (active) {
          toast.error(err instanceof Error ? err.message : "No se pudo restaurar la sesión");
        }
      } finally {
        if (active) setBusy(false);
      }
    };

    void restoreSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Never let an older persisted session bypass a pending OAuth result.
      if (!active || !session || code || oauthError) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        go();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [code, next, oauthError, oauthErrorDescription]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const target = normalizePostLoginTarget(next);
        const callbackUrl = new URL("/auth", window.location.origin);
        callbackUrl.searchParams.set("next", target);

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // PKCE callbacks must return through /auth so the code is exchanged
            // before entering a protected route.
            emailRedirectTo: callbackUrl.toString(),
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          toast.success("Cuenta creada. Confirmá tu email para entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo autenticar");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await signInWithGoogle(next);
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar con Google");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="label-caps hover:text-foreground">
          MELANO INC
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Autonomous Command Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Acceso privado al sistema." : "Creá tu acceso al sistema."}
        </p>

        {checkEmail ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Te enviamos un email de confirmación a <span className="text-foreground">{email}</span>.
            Confirmá el acceso y volvé a esta pantalla.
          </div>
        ) : null}

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={handleGoogle}
          >
            {busy ? "Restaurando sesión…" : "Continuar con Google"}
          </Button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Bruno Melano"
                  autoComplete="name"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Procesando…" : mode === "signin" ? "Entrar" : "Crear acceso"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setCheckEmail(false);
            }}
          >
            {mode === "signin"
              ? "No tengo acceso todavía — crear cuenta"
              : "Ya tengo acceso — iniciar sesión"}
          </button>
        </div>
      </div>
    </main>
  );
}
