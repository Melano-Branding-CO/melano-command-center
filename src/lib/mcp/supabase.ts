import { createClient } from "@supabase/supabase-js";
import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env?.[name];
}
function configuredEnv(names: readonly string[]) {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}
function supabaseProjectUrl() {
  const value = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? import.meta.env["VITE_SUPABASE_URL"];
  if (!value) throw new ToolError("La conexión de datos no está configurada.");
  return value;
}
function supabasePublishableKey() {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const values = parsed as Record<string, unknown>;
        const key = [values["default"], ...Object.values(values)].find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"));
        if (key) return key.trim();
      }
    } catch { /* Other supported keys may still be present. */ }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]) ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!legacy) throw new ToolError("La conexión de datos no está configurada.");
  return legacy;
}
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token || !ctx.isAuthenticated()) throw new ToolError("Iniciá sesión para consultar esta app.");
  return createClient<Database>(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireOrganization(ctx: ToolContext, organizationId: string) {
  const db = supabaseForUser(ctx);
  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("Iniciá sesión para consultar esta app.");
  const { data, error } = await db.from("organization_members").select("organization_id")
    .eq("organization_id", organizationId).eq("user_id", userId).abortSignal(ctx.signal).maybeSingle();
  if (error) throw new ToolError("No se pudieron verificar los permisos.");
  if (!data) throw new ToolError("No tenés acceso a esta organización.");
  return db;
}