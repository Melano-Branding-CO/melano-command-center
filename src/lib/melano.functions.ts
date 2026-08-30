import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runMeetingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN", "OPERATOR"].includes(member.role)) {
      throw new Error("Sin permisos para ejecutar la reunión");
    }
    const { runExecutiveMeetingServer } = await import("./melano-ai.server");
    const result = await runExecutiveMeetingServer({
      orgId: data.organizationId,
      trigger: "manual",
    });
    return { meetingId: result.meetingId, traceId: result.traceId };
  });

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentId: string; organizationId: string }) => {
    if (!input?.agentId || !input?.organizationId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN", "OPERATOR"].includes(member.role)) {
      throw new Error("Sin permisos para ejecutar agentes");
    }
    const { runAgentServer } = await import("./melano-ai.server");
    const { parsed, traceId } = await runAgentServer(data.agentId);
    return { traceId, output: parsed };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string; approve: boolean; note?: string }) => {
    if (!input?.approvalId) throw new Error("approvalId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: approval, error } = await context.supabase
      .from("approvals")
      .update({
        status: data.approve ? "APPROVED" : "REJECTED",
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.approvalId)
      .eq("status", "PENDING")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!approval) throw new Error("Aprobación no encontrada o ya resuelta");

    if (approval.decision_id) {
      await context.supabase
        .from("decisions")
        .update({
          status: data.approve ? "APPROVED" : "REJECTED",
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", approval.decision_id);
    }

    await context.supabase.from("activity_logs").insert({
      organization_id: approval.organization_id,
      actor_type: "human",
      actor_user: context.userId,
      action: data.approve ? "approval.approved" : "approval.rejected",
      entity_type: "approval",
      entity_id: approval.id,
      detail: { action: approval.action, note: data.note ?? null },
      trace_id: approval.trace_id,
    });

    return { status: approval.status };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN"].includes(member.role)) {
      throw new Error("Sólo CEO o ADMIN pueden limpiar datos demo");
    }
    const tables = [
      "approvals",
      "tasks",
      "decisions",
      "alerts",
      "metrics",
      "projects",
      "automation_rules",
    ] as const;
    for (const table of tables) {
      await context.supabase
        .from(table)
        .delete()
        .eq("organization_id", data.organizationId)
        .eq("is_demo", true);
    }
    return { ok: true };
  });

export const setAutonomyLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; level: number }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    if (input.level < 0 || input.level > 5) throw new Error("Nivel inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organizations")
      .update({ autonomy_level: data.level })
      .eq("id", data.organizationId);
    if (error) throw error;
    return { level: data.level };
  });
