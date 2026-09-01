/**
 * Cabeceras para llamar webhooks de n8n protegidos con Header Auth.
 * Los valores se leen en tiempo de ejecución (nunca en el bundle del cliente).
 */
export function n8nWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const name = env?.["N8N_WEBHOOK_HEADER"]?.trim();
  const value = env?.["N8N_WEBHOOK_TOKEN"]?.trim();
  if (name && value) headers[name] = value;
  return headers;
}
