/**
 * URL y token de callback que n8n debe usar al terminar un run.
 *
 * El token es un HMAC-SHA256 del trace_id firmado con LOVABLE_CRON_SECRET:
 * así n8n puede cerrar SOLO el run que se le despachó, sin conocer el secreto.
 */
function env(key: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    key
  ];
}

export function n8nCallbackUrl(): string {
  const base = (env("APP_BASE_URL") ?? "https://comandcenter.tech").replace(/\/+$/, "");
  return `${base}/api/public/n8n/callback`;
}

async function sign(traceId: string, secret: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(traceId, "utf8").digest("hex");
}

/** Token de un solo trace para autenticar el callback de n8n. */
export async function n8nCallbackToken(traceId: string): Promise<string | null> {
  const secret = env("LOVABLE_CRON_SECRET");
  if (!secret) return null;
  return sign(traceId, secret);
}

/** Verifica el token recibido contra el trace_id (constante en tiempo). */
export async function verifyN8nCallbackToken(traceId: string, token: string): Promise<boolean> {
  const secrets = [env("LOVABLE_CRON_SECRET"), env("LOVABLE_CRON_SECRET_PREVIOUS")].filter(
    (s): s is string => Boolean(s),
  );
  if (!secrets.length || !token) return false;
  const { timingSafeEqual } = await import("node:crypto");
  const provided = Buffer.from(token, "utf8");
  for (const secret of secrets) {
    const expected = Buffer.from(await sign(traceId, secret), "utf8");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return true;
  }
  return false;
}
