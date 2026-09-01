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
    .select("id, name, n8n_webhook_url, n8n_workflow")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .not("n8n_webhook_url", "is", null)
    .order("created_at")
    .limit(1);
  const rule = rules?.[0];
  if (!rule?.n8n_webhook_url) {
    return {
      ok: false,
      traceId: null,
      rule: null,
      status: "SKIPPED",
      output: "",
      error: "No hay workflow de n8n activo. Configuralo en Automations.",
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
    const res = await fetch(rule.n8n_webhook_url as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
