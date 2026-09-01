/**
 * Cliente de la API pública de n8n (credencial X-N8N-API-KEY).
 * Solo se usa en servidor: las variables se leen en tiempo de ejecución.
 */
type Env = Record<string, string | undefined>;

function env(name: string): string | undefined {
  const runtime = (globalThis as { process?: { env?: Env } }).process?.env;
  return runtime?.[name]?.trim() || undefined;
}

export function n8nApiConfigured(): boolean {
  return Boolean(env("N8N_API_KEY") && env("N8N_BASE_URL"));
}

function baseUrl(): string {
  return (env("N8N_BASE_URL") ?? "").replace(/\/+$/, "");
}

async function apiGet<T>(path: string): Promise<T> {
  const key = env("N8N_API_KEY");
  if (!key || !baseUrl()) throw new Error("Falta N8N_API_KEY o N8N_BASE_URL");
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`n8n API HTTP ${res.status}`);
  return (await res.json()) as T;
}

type N8nNode = { type?: string; parameters?: { path?: string } };
type N8nWorkflow = { id: string; name: string; active: boolean; nodes?: N8nNode[] };

/**
 * Resuelve la URL productiva del webhook del workflow activo.
 * Si se pasa un nombre/ID de workflow, lo prioriza.
 */
export async function resolveActiveWebhookUrl(
  workflowHint?: string | null,
): Promise<{ url: string; workflow: string } | null> {
  if (!n8nApiConfigured()) return null;
  const { data } = await apiGet<{ data: N8nWorkflow[] }>("/api/v1/workflows?active=true&limit=100");
  const list = data ?? [];
  const hint = workflowHint?.trim().toLowerCase();
  const ordered = hint
    ? [...list].sort((a, b) => {
        const score = (w: N8nWorkflow) =>
          w.id.toLowerCase() === hint || w.name.toLowerCase().includes(hint) ? 0 : 1;
        return score(a) - score(b);
      })
    : list;

  for (const wf of ordered) {
    const webhook = (wf.nodes ?? []).find(
      (n) => n.type?.includes("webhook") && typeof n.parameters?.path === "string",
    );
    const path = webhook?.parameters?.path;
    if (path) return { url: `${baseUrl()}/webhook/${path.replace(/^\/+/, "")}`, workflow: wf.name };
  }
  return null;
}
