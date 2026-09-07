/**
 * Cabeceras para llamar webhooks de n8n protegidos con Header Auth.
 * Los valores se leen en tiempo de ejecución (nunca en el bundle del cliente).
 */
function runtimeEnv() {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
}

export function hasN8nWebhookToken(): boolean {
  return Boolean(runtimeEnv()?.["N8N_WEBHOOK_TOKEN"]?.trim());
}

export function n8nWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const env = runtimeEnv();
  const name = env?.["N8N_WEBHOOK_HEADER"]?.trim() || "X-Command-Center-Token";
  const value = env?.["N8N_WEBHOOK_TOKEN"]?.trim();
  if (value) headers[name] = value;
  return headers;
}
