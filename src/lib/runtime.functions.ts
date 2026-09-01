import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canonicalTaskKey } from "@/lib/runtime-contract";

type Serializable = string | number | boolean | null | Serializable[] | { [k: string]: Serializable };
type DbLike = { from: (table: string) => any };

const EXECUTOR_ROLES = ["CEO", "ADMIN", "OPERATOR"];
const APPROVER_ROLES = ["CEO", "ADMIN"];

async function assertTenantRole(
  context: { supabase: unknown; userId: string },
  tenantId: string,
  allowed: string[],
) {
  const db = context.supabase as DbLike;
  const { data: member, error } = await db
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!member || !allowed.includes(String(member.role).toUpperCase())) {
    throw new Error("Sin permisos para esta acción");
  }
  return String(member.role).toUpperCase();
}

function dueAtFor(priority: string, now = new Date()) {
  if (priority === "P0") return new Date(now.getTime() + 24 * 3600_000).toISOString();
  if (priority === "P1") return new Date(now.getTime() + 72 * 3600_000).toISOString();
  if (priority === "P2") return new Date(now.getTime() + 7 * 86_400_000).toISOString();
  return null;
}

export const runMeetingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("tenantId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertTenantRole(context, data.organizationId, EXECUTOR_ROLES);
    const { runExecutiveMeetingServer } = await import("./melano-ai.server");
    const result = await runExecutiveMeetingServer({ orgId: data.organizationId, trigger: "manual" });
    return { meetingId: result.meetingId, traceId: result.traceId };
  });

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentId: string; organizationId: string }) => {
    if (!input?.agentId || !input?.organizationId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertTenantRole(context, data.organizationId, EXECUTOR_ROLES);
    const { runAgentServer } = await import("./melano-ai.server");
    const { parsed, traceId } = await runAgentServer(data.agentId);
    return {
      traceId,
      output: JSON.parse(JSON.stringify(parsed)) as Record<string, Serializable>,
    };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string; approve: boolean; note?: string }) => {
    if (!input?.approvalId) throw new Error("approvalId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userDb = context.supabase as DbLike;
    const { data: approval, error: approvalError } = await userDb
      .from("approvals")
      .select("id,tenant_id,decision_id,status")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (approvalError) throw approvalError;
    if (!approval) throw new Error("Aprobación no encontrada");
    if (approval.status !== "pending") throw new Error("Aprobación ya resuelta");

    await assertTenantRole(context, approval.tenant_id, APPROVER_ROLES);

    const { data: decision, error: decisionError } = await userDb
      .from("decisions")
      .select("id,tenant_id,title,priority,action_type")
      .eq("tenant_id", approval.tenant_id)
      .eq("id", approval.decision_id)
      .maybeSingle();
    if (decisionError) throw decisionError;
    if (!decision) throw new Error("Decisión asociada no encontrada");

    const dueAt = data.approve ? dueAtFor(decision.priority) : null;
    const canonicalKey = canonicalTaskKey({
      tenantId: decision.tenant_id,
      actionType: decision.action_type ?? "review",
      title: decision.title,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
    };
    const { data: result, error } = await admin.rpc("resolve_runtime_approval", {
      p_approval_id: data.approvalId,
      p_approved: data.approve,
      p_user_id: context.userId,
      p_note: data.note ?? null,
      p_due_at: dueAt,
      p_canonical_key: canonicalKey,
    });
    if (error) throw error;

    return result as { status: string; task_id: string | null };
  });
