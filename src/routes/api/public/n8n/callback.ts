import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Callback de n8n: cierra el ciclo de un run disparado desde el Command Center.
 * Autenticación: Authorization: Bearer <LOVABLE_CRON_SECRET>.
 *
 * Body JSON:
 * {
 *   "trace_id": "uuid",              // requerido: el trace enviado en el disparo
 *   "status": "SUCCESS" | "FAILED",  // resultado real del workflow
 *   "outcome": "texto del resultado",
 *   "error": "detalle si falló",
 *   "task_id": "uuid",               // opcional (si no, se resuelve por trace_id)
 *   "decision_id": "uuid"            // opcional
 * }
 */
type Body = {
  trace_id?: string;
  status?: string;
  outcome?: string;
  result?: string;
  error?: string;
  task_id?: string;
  decision_id?: string;
  detail?: unknown;
};

async function handle(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const traceId = String(body.trace_id ?? "").trim();
  if (!traceId) return Response.json({ ok: false, error: "trace_id requerido" }, { status: 400 });

  // Autenticación: secreto de cron completo, o token HMAC firmado para ese trace.
  const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const { verifyN8nCallbackToken } = await import("@/lib/n8n-callback");
  const traceTokenOk = await verifyN8nCallbackToken(traceId, bearer);
  if (!traceTokenOk) {
    const unauthorized = await authenticateCronRequest(request);
    if (unauthorized) return unauthorized;
  }

  const ok = String(body.status ?? "SUCCESS").toUpperCase() !== "FAILED" && !body.error;
  const outcome = (body.outcome ?? body.result ?? "").toString().slice(0, 4000) || null;
  const errorText = body.error ? String(body.error).slice(0, 2000) : null;
  const finishedAt = new Date().toISOString();

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: run } = await supabaseAdmin
      .from("automation_runs")
      .select("id, organization_id, rule_id")
      .eq("trace_id", traceId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run) {
      return Response.json({ ok: false, error: "trace_id sin run asociado" }, { status: 404 });
    }

    await supabaseAdmin
      .from("automation_runs")
      .update({
        status: ok ? "SUCCESS" : "FAILED",
        finished_at: finishedAt,
        output: outcome ?? "",
        error: errorText,
      })
      .eq("id", run.id);

    if (run.rule_id) {
      await supabaseAdmin
        .from("automation_rules")
        .update({
          last_run_at: finishedAt,
          last_result: ok ? (outcome ?? "OK").slice(0, 500) : null,
          last_error: errorText,
          status: ok ? "OK" : "ERROR",
        })
        .eq("id", run.rule_id);
    }

    // Tarea: cierre real con outcome
    let taskId = body.task_id ?? null;
    if (!taskId) {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("id")
        .eq("organization_id", run.organization_id)
        .eq("trace_id", traceId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      taskId = task?.id ?? null;
    }
    if (taskId) {
      await supabaseAdmin
        .from("tasks")
        .update({
          status: ok ? "DONE" : "FAILED",
          result: outcome,
          error: errorText,
          completed_at: ok ? finishedAt : null,
          trace_id: traceId,
        })
        .eq("id", taskId)
        .eq("organization_id", run.organization_id);
    }

    // Decisión: outcome real
    let decisionId = body.decision_id ?? null;
    if (!decisionId) {
      const { data: decision } = await supabaseAdmin
        .from("decisions")
        .select("id")
        .eq("organization_id", run.organization_id)
        .eq("trace_id", traceId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      decisionId = decision?.id ?? null;
    }
    if (decisionId) {
      await supabaseAdmin
        .from("decisions")
        .update({
          status: ok ? "COMPLETED" : "FAILED",
          outcome: outcome ?? errorText,
          outcome_at: finishedAt,
        })
        .eq("id", decisionId)
        .eq("organization_id", run.organization_id);
    }

    await supabaseAdmin.from("activity_logs").insert({
      organization_id: run.organization_id,
      actor_type: "system",
      action: "n8n.callback",
      entity_type: taskId ? "task" : decisionId ? "decision" : "automation_run",
      entity_id: taskId ?? decisionId ?? run.id,
      trace_id: traceId,
      detail: {
        status: ok ? "SUCCESS" : "FAILED",
        outcome,
        error: errorText,
        payload: (body.detail ?? null) as never,
      } as never,
    });

    return Response.json({
      ok: true,
      trace_id: traceId,
      run_id: run.id,
      task_id: taskId,
      decision_id: decisionId,
      status: ok ? "SUCCESS" : "FAILED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[n8n:callback]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/n8n/callback")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
