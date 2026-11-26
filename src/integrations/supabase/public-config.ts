export const SUPABASE_PUBLIC_CONFIG_ID = "supabase-public-config";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Legacy anon JWTs are public; service-role JWTs must never reach the HTML.
  const parts = key.split(".");
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))).role === "anon";
  } catch {
    return false;
  }
}

export function validateSupabasePublicConfig(value: unknown): SupabasePublicConfig {
  if (!value || typeof value !== "object")
    throw new Error("Falta la configuración pública de conexión.");
  const { url, publishableKey } = value as Partial<SupabasePublicConfig>;
  if (!url || !publishableKey) throw new Error("Falta la configuración pública de conexión.");
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error("La URL pública de conexión no es válida.");
  }
  if (typeof publishableKey !== "string" || !isPublicKey(publishableKey)) {
    throw new Error("La configuración del navegador requiere una clave pública.");
  }
  // Allowlist these two fields. Never serialize an environment object.
  return { url: parsed.origin, publishableKey };
}

export function serializeSupabasePublicConfig(config: SupabasePublicConfig): string {
  return JSON.stringify(validateSupabasePublicConfig(config)).replace(/</g, "\\u003c");
}
