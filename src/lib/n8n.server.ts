/**
 * Cliente n8n server-only.
 *
 * Seguridad:
 * - El host SIEMPRE proviene de N8N_BASE_URL (secreto de backend). Nunca de la base
 *   de datos ni del cliente, lo que elimina cualquier vector de SSRF.
 * - Del registro sólo se usa un slug de workflow validado ([a-z0-9-_]).
 * - El token se envía en un header y nunca se registra ni se devuelve al cliente.
 */

const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/;

export function isValidWorkflowSlug(slug: string | null | undefined): slug is string {
  return !!slug && SLUG_RE.test(slug);
}

export function n8nConfigured() {
  return !!process.env["N8N_BASE_URL"] && !!process.env["N8N_WEBHOOK_TOKEN"];
}

/** Deriva el slug desde una URL de webhook guardada previamente. */
export function slugFromWebhookUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const last = url.split("?")[0]!.replace(/\/+$/, "").split("/").pop() ?? "";
  return isValidWorkflowSlug(last) ? last : null;
}

export type N8nResult = {
  ok: boolean;
  status: number;
  body: string;
  url: string;
};

export async function dispatchN8nWorkflow(
  slug: string,
  payload: Record<string, unknown>,
  opts: { test?: boolean } = {},
): Promise<N8nResult> {
  const base = process.env["N8N_BASE_URL"];
  const token = process.env["N8N_WEBHOOK_TOKEN"];
  const header = process.env["N8N_WEBHOOK_HEADER"] || "x-melano-token";

  if (!base || !token) {
    throw new Error("n8n no está configurado en el backend (falta N8N_BASE_URL o N8N_WEBHOOK_TOKEN)");
  }
  if (!isValidWorkflowSlug(slug)) throw new Error("Workflow inválido");

  const origin = new URL(base).origin; // sólo esquema + host del secreto
  const url = `${origin}/webhook${opts.test ? "-test" : ""}/${slug}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [header]: token,
      },
      body: JSON.stringify(payload),
    });
    const text = (await res.text()).slice(0, 2000);
    return { ok: res.ok, status: res.status, body: text, url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, body: message, url };
  } finally {
    clearTimeout(timeout);
  }
}
