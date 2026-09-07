import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  tenantId: string;
  approvalId: string;
  currency: string;
  revenueUpside30d: number;
  costAvoidance30d: number;
  riskAvoidance30d: number;
  implementationCost: number;
  confidence: number;
  evidenceNote: string;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} inválido`);
  return value;
}

export const updateApprovalEconomics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.tenantId || !input?.approvalId) throw new Error("tenantId y approvalId requeridos");
    const currency = (input.currency ?? "USD").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Moneda inválida");
    const evidenceNote = (input.evidenceNote ?? "").trim();
    if (evidenceNote.length < 3) throw new Error("La evidencia es obligatoria");
    const confidence = Number(input.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("La confianza debe estar entre 0 y 1");
    }
    return {
      tenantId: input.tenantId,
      approvalId: input.approvalId,
      currency,
      revenueUpside30d: nonNegative(Number(input.revenueUpside30d), "Revenue"),
      costAvoidance30d: nonNegative(Number(input.costAvoidance30d), "Ahorro"),
      riskAvoidance30d: nonNegative(Number(input.riskAvoidance30d), "Riesgo evitado"),
      implementationCost: nonNegative(Number(input.implementationCost), "Costo"),
      confidence,
      evidenceNote: evidenceNote.slice(0, 1200),
    };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (table: string) => any };
    const { data: member, error: memberError } = await db
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw memberError;
    const role = String(member?.role ?? "").toLowerCase();
    if (!member || !["owner", "admin"].includes(role)) {
      throw new Error("Sólo owner/admin pueden definir el caso económico");
    }

    const { data: approval, error } = await db
      .from("approvals")
      .select("id, tenant_id, status, metadata, trace_id, action_type")
      .eq("id", data.approvalId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!approval) throw new Error("Aprobación no encontrada");
    if (String(approval.status).toLowerCase() !== "pending") {
      throw new Error("Sólo se puede editar una aprobación pendiente");
    }

    const grossBenefit30d = data.revenueUpside30d + data.costAvoidance30d + data.riskAvoidance30d;
    if (grossBenefit30d + data.implementationCost <= 0) {
      throw new Error("Cuantificá al menos un beneficio o costo");
    }
    const expectedValue30d = money(grossBenefit30d * data.confidence - data.implementationCost);
    const paybackDays = data.implementationCost <= 0
      ? 0
      : grossBenefit30d > 0
        ? Math.round((data.implementationCost / (grossBenefit30d / 30)) * 10) / 10
        : null;

    const businessCase = {
      version: 1,
      currency: data.currency,
      revenue_upside_30d: money(data.revenueUpside30d),
      cost_avoidance_30d: money(data.costAvoidance30d),
      risk_avoidance_30d: money(data.riskAvoidance30d),
      implementation_cost: money(data.implementationCost),
      confidence: Math.round(data.confidence * 1000) / 1000,
      gross_benefit_30d: money(grossBenefit30d),
      expected_value_30d: expectedValue30d,
      payback_days: paybackDays,
      gate: expectedValue30d > 0 ? "POSITIVE_EV" : "NON_POSITIVE_EV",
      evidence_note: data.evidenceNote,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };

    const metadata = {
      ...(approval.metadata && typeof approval.metadata === "object" ? approval.metadata : {}),
      business_case: businessCase,
    };

    const { error: updateError } = await db
      .from("approvals")
      .update({ metadata })
      .eq("id", approval.id)
      .eq("tenant_id", data.tenantId)
      .eq("status", "pending");
    if (updateError) throw updateError;

    await db.from("automation_logs").insert({
      tenant_id: data.tenantId,
      trace_id: approval.trace_id,
      approval_id: approval.id,
      event_type: "approval.business_case.updated",
      actor_type: "human",
      actor_id: context.userId,
      status: "success",
      message: `Caso económico actualizado para ${approval.action_type}`,
      payload: { business_case: businessCase },
    });

    return { businessCase };
  });
