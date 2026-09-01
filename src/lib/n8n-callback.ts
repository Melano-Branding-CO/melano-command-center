/**
 * URL de callback que n8n debe llamar al terminar un run.
 * n8n autentica con su propia credencial Bearer (LOVABLE_CRON_SECRET).
 */
export function n8nCallbackUrl(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const base = (env?.["APP_BASE_URL"] ?? "https://comandcenter.tech").replace(/\/+$/, "");
  return `${base}/api/public/n8n/callback`;
}
