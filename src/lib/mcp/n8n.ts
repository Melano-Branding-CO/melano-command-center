import { n8nWebhookHeaders } from "../n8n-headers";
// Puente MCP → n8n: usa el workflow activo de la organización y deja traza auditable
// en automation_runs + activity_logs (visibles en /today y /meetings).
import type { Authed } from "./supabase";

export type N8nDispatchResult = {
  ok: boolean;
  traceId: string | null;
  rule: string | null;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  output: string;
  error: string | null;
};

type Entity = { type: string; id: string; meetingId?: string | null };

/** Dispara el webhook de n8n activo y persiste run + log. No lanza. */
export async function dispatchN8n(
  db: Authed,
  userId: string,
  organizationId: string,
  event: string,
  entity: Entity,
  payload: Record<string, unknown>,
): Promise<N8nDispatchResult> {
  const { data: rules } = await db
    .from("automation_rules")
    .select("id, name, n8n_webhook_url, n8n_workflow, status")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .order("created_at");
  // Preferimos una regla sana con webhook cargado; nunca una que ya viene fallando.
  const candidates = (rules ?? []) as Array<{
    id: string;
    name: string;
    n8n_webhook_url: string | null;
    n8n_workflow: string | null;
    status: string | null;
  }>;
  const rule =
    candidates.find((r) => r.n8n_webhook_url && r.status !== "ERROR") ??
    candidates.find((r) => r.n8n_webhook_url) ??
    candidates[0];

  if (!rule) {
    return {
      ok: false,
      traceId: null,
      rule: null,
      status: "SKIPPED",
      output: "",
      error: "No hay automatización de n8n activa. Configurala en Automations.",
    };
  }

  // Respaldo: si la regla no tiene webhook cargado, lo resolvemos con la API de n8n.
  let webhookUrl = (rule.n8n_webhook_url as string | null) ?? null;
  if (!webhookUrl) {
    const { resolveActiveWebhookUrl } = await import("../n8n-api");
    try {
      const resolved = await resolveActiveWebhookUrl(rule.n8n_workflow as string | null);
      if (resolved) {
        webhookUrl = resolved.url;
        await db
          .from("automation_rules")
          .update({
            n8n_webhook_url: resolved.url,
            n8n_workflow: rule.n8n_workflow ?? resolved.workflow,
          })
          .eq("id", rule.id);
      }
    } catch {
      // seguimos con el error de configuración de abajo
    }
  }
  if (!webhookUrl) {
    return {
      ok: false,
      traceId: null,
      rule: (rule.n8n_workflow ?? rule.name) as string,
      status: "SKIPPED",
      output: "",
      error: "No se pudo resolver el webhook del workflow activo de n8n.",
    };
  }

  const traceId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { data: run } = await db
    .from("automation_runs")
    .insert({
      organization_id: organizationId,
      rule_id: rule.id,
      status: "RUNNING",
      started_at: startedAt,
      trace_id: traceId,
    })
    .select("id")
    .maybeSingle();

  let status: "SUCCESS" | "FAILED" = "SUCCESS";
  let output = "";
  let errorText: string | null = null;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: n8nWebhookHeaders(),
      body: JSON.stringify({
        source: "melano-command-center",
        channel: "mcp",
        event,
        organization_id: organizationId,
        rule_id: rule.id,
        rule_name: rule.name,
        workflow: rule.n8n_workflow,
        trace_id: traceId,
        triggered_by: userId,
        triggered_at: startedAt,
        entity_type: entity.type,
        entity_id: entity.id,
        meeting_id: entity.meetingId ?? null,
        callback_url: (await import("../n8n-callback")).n8nCallbackUrl(),
        callback_token: await (await import("../n8n-callback")).n8nCallbackToken(traceId),
        ...payload,
      }),
    });
    output = (await res.text()).slice(0, 4000);
    if (!res.ok) {
      status = "FAILED";
      errorText = `HTTP ${res.status}`;
    }
  } catch (err) {
    status = "FAILED";
    errorText = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date().toISOString();
  if (run?.id) {
    await db
      .from("automation_runs")
      .update({ status, finished_at: finishedAt, output, error: errorText })
      .eq("id", run.id);
  }
  await db
    .from("automation_rules")
    .update({
      last_run_at: finishedAt,
      last_result: status === "SUCCESS" ? output.slice(0, 500) || "OK" : null,
      last_error: errorText,
      status: status === "SUCCESS" ? "OK" : "ERROR",
    })
    .eq("id", rule.id);
  await db.from("activity_logs").insert({
    organization_id: organizationId,
    actor_type: "user",
    actor_user: userId,
    action: event,
    entity_type: entity.type,
    entity_id: entity.id,
    trace_id: traceId,
    detail: {
      channel: "mcp",
      rule: rule.name,
      workflow: rule.n8n_workflow,
      meeting_id: entity.meetingId ?? null,
      title: payload["title"] ?? null,
      status,
      error: errorText,
      output: output.slice(0, 500),
    },
  });

  return {
    ok: status === "SUCCESS",
    traceId,
    rule: (rule.n8n_workflow ?? rule.name) as string,
    status,
    output,
    error: errorText,
  };
}
