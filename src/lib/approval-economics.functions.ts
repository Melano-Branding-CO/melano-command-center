import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonRecord = Record<string, unknown>;

type BusinessCaseInput = {
  organizationId: string;
  approvalId: string;
  currency: string;
  revenueUpside30d: number;
  costAvoidance30d: number;
  riskAvoidance30d: number;
  implementationCost: number;
  confidence: number;
  evidenceNote: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function nonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} debe ser un número mayor o igual a 0`);
  }
  return value;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const updateApprovalEconomics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BusinessCaseInput) => {
    if (!input?.organizationId || !input?.approvalId) {
      throw new Error("organizationId y approvalId son requeridos");
    }

    const currency = (input.currency ?? "USD").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Moneda inválida");

    const evidenceNote = (input.evidenceNote ?? "").trim();
    if (evidenceNote.length < 3) {
      throw new Error("Indicá la evidencia o fuente del caso económico");
    }

    const confidence = Number(input.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("La confianza debe estar entre 0 y 1");
    }

    const validated = {
      organizationId: input.organizationId,
      approvalId: input.approvalId,
      currency,
      revenueUpside30d: nonNegative(Number(input.revenueUpside30d), "Revenue 30d"),
      costAvoidance30d: nonNegative(Number(input.costAvoidance30d), "Ahorro 30d"),
      riskAvoidance30d: nonNegative(Number(input.riskAvoidance30d), "Riesgo evitado 30d"),
      implementationCost: nonNegative(Number(input.implementationCost), "Costo de implementación"),
      confidence,
      evidenceNote: evidenceNote.slice(0, 1200),
    };

    const totalEconomicMovement =
      validated.revenueUpside30d +
      validated.costAvoidance30d +
      validated.riskAvoidance30d +
      validated.implementationCost;
    if (totalEconomicMovement <= 0) {
      throw new Error("El caso económico debe cuantificar al menos un beneficio o costo");
    }

    return validated;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!member || !["CEO", "ADMIN"].includes(member.role)) {
      throw new Error("Sólo CEO o ADMIN pueden definir el caso económico de una aprobación");
    }

    const { data: approval, error } = await context.supabase
      .from("approvals")
      .select("id, action, status, payload, trace_id")
      .eq("id", data.approvalId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    if (error) throw error;
    if (!approval) throw new Error("Aprobación no encontrada");
    if (String(approval.status).toUpperCase() !== "PENDING") {
      throw new Error("Sólo se puede editar el caso económico de una aprobación pendiente");
    }

    const grossBenefit30d =
      data.revenueUpside30d + data.costAvoidance30d + data.riskAvoidance30d;
    const expectedValue30d = roundMoney(grossBenefit30d * data.confidence - data.implementationCost);
    const dailyGrossBenefit = grossBenefit30d / 30;
    const paybackDays =
      data.implementationCost <= 0
        ? 0
        : dailyGrossBenefit > 0
          ? Math.round((data.implementationCost / dailyGrossBenefit) * 10) / 10
          : null;

    const businessCase = {
      version: 1,
      currency: data.currency,
      revenue_upside_30d: roundMoney(data.revenueUpside30d),
      cost_avoidance_30d: roundMoney(data.costAvoidance30d),
      risk_avoidance_30d: roundMoney(data.riskAvoidance30d),
      implementation_cost: roundMoney(data.implementationCost),
      confidence: Math.round(data.confidence * 1000) / 1000,
      gross_benefit_30d: roundMoney(grossBenefit30d),
      expected_value_30d: expectedValue30d,
      payback_days: paybackDays,
      gate: expectedValue30d > 0 ? "POSITIVE_EV" : "NON_POSITIVE_EV",
      evidence_note: data.evidenceNote,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };

    const payload = {
      ...asRecord(approval.payload),
      business_case: businessCase,
    };

    const { error: updateError } = await context.supabase
      .from("approvals")
      .update({ payload })
      .eq("id", approval.id)
      .eq("organization_id", data.organizationId)
      .eq("status", "PENDING");
    if (updateError) throw updateError;

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "approval.business_case.updated",
      entity_type: "approval",
      entity_id: approval.id,
      trace_id: approval.trace_id,
      detail: {
        approval_action: approval.action,
        business_case: businessCase,
      },
    });

    return { businessCase };
  });
