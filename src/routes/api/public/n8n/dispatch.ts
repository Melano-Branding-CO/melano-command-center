import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Endpoint entrante para n8n.
 * Autenticación: Authorization: Bearer <LOVABLE_CRON_SECRET>.
 *
 * Body JSON:
 *  { "action": "run_meeting" }
 *  { "action": "run_agent", "agentCode": "CRO" }            // o "agentId"
 *  { "action": "create_task", "title": "...", "description": "...", "priority": "P1" }
 *  { "action": "log", "message": "...", "detail": { ... } }
 */
type Body = {
  action?: string;
  organizationId?: string;
  agentId?: string;
  agentCode?: string;
  title?: string;
  description?: string;
  priority?: string;
  message?: string;
  detail?: unknown;
};

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

async function handle(request: Request) {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }
  const action = String(body.action ?? "").trim();
  if (!action) return Response.json({ ok: false, error: "action requerido" }, { status: 400 });

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveOrgId, runAgentServer, runExecutiveMeetingServer } = await import(
      "@/lib/melano-ai.server"
    );
    const orgId = await resolveOrgId(body.organizationId);

    async function log(actionName: string, detail: Record<string, unknown>) {
      await supabaseAdmin.from("activity_logs").insert({
        organization_id: orgId,
        actor_type: "system",
        action: actionName,
        entity_type: "n8n",
        detail: detail as never,
      });
    }

    if (action === "run_meeting") {
      const result = await runExecutiveMeetingServer({ orgId, trigger: "external_event" as never });
      await log("n8n.run_meeting", { meetingId: result.meetingId, traceId: result.traceId });
      return Response.json({ ok: true, meetingId: result.meetingId, traceId: result.traceId });
    }

    if (action === "run_agent") {
      let agentId = body.agentId ?? null;
      if (!agentId && body.agentCode) {
        const { data } = await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("organization_id", orgId)
          .eq("code", body.agentCode)
          .maybeSingle();
        agentId = data?.id ?? null;
      }
      if (!agentId) {
        return Response.json({ ok: false, error: "agentId o agentCode inválido" }, { status: 400 });
      }
      const { parsed, traceId } = await runAgentServer(agentId);
      await log("n8n.run_agent", { agentId, traceId });
      return Response.json({ ok: true, traceId, output: parsed });
    }

    if (action === "create_task") {
      const title = String(body.title ?? "").trim();
      if (!title) return Response.json({ ok: false, error: "title requerido" }, { status: 400 });
      const priority = PRIORITIES.includes(body.priority as never) ? body.priority! : "P2";
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          organization_id: orgId,
          title,
          description: body.description ?? null,
          priority: priority as never,
          status: "READY",
          why_now: "Generada por un workflow de n8n",
        })
        .select("id")
        .single();
      if (error) throw error;
      await log("n8n.create_task", { taskId: data.id, title });
      return Response.json({ ok: true, taskId: data.id });
    }

    if (action === "log") {
      await log("n8n.log", {
        message: body.message ?? null,
        payload: (body.detail ?? null) as never,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: `action desconocida: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[n8n:dispatch]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/n8n/dispatch")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
