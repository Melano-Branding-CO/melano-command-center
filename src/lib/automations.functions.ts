import { createServerFn } from "@tanstack/react-start";
import { workflowOutcome } from "./n8n-result";
import { checked } from "./operational-guards";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPERATOR_ROLES = ["CEO", "ADMIN", "OPERATOR"];

type Ctx = { supabase: { from: (t: string) => any }; userId: string };

async function assertOperator(context: Ctx, organizationId: string) {
  const { data: member } = await context.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!member || !OPERATOR_ROLES.includes(member.role)) {
    throw new Error("Sin permisos para operar automatizaciones");
  }
  return member.role as string;
}

export type AutomationStatus = {
  configured: boolean;
  host: string | null;
};

/** Estado de la conexión con n8n (sin exponer tokens). */
export const getN8nStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AutomationStatus> => {
    const base = process.env["N8N_BASE_URL"];
    const token = process.env["N8N_WEBHOOK_TOKEN"];
    let host: string | null = null;
    try {
      host = base ? new URL(base).host : null;
    } catch {
      host = null;
    }
    return { configured: !!host && !!token, host };
  });

/** Ejecuta una regla real contra n8n y persiste la corrida en automation_runs. */
export const runAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; ruleId: string; test?: boolean }) => {
    if (!input?.organizationId || !input?.ruleId) throw new Error("Parámetros inválidos");
    return { ...input, test: !!input.test };
  })
  .handler(async ({ data, context }) => {
    await assertOperator(context as Ctx, data.organizationId);

    const { data: rule, error } = await context.supabase
      .from("automation_rules")
      .select("id, name, action, enabled, n8n_workflow, n8n_webhook_url, organization_id")
      .eq("id", data.ruleId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rule) throw new Error("Automatización no encontrada");

    const { dispatchN8nWorkflow, slugFromWebhookUrl, isValidWorkflowSlug, n8nConfigured } =
      await import("./n8n.server");
    const slug = isValidWorkflowSlug(rule.n8n_workflow)
      ? rule.n8n_workflow
      : slugFromWebhookUrl(rule.n8n_webhook_url);
    if (!slug) throw new Error("La automatización no tiene un workflow de n8n configurado");

    if (!rule.enabled && !data.test) throw new Error("BLOQUEO: automatización pausada");
    if (!n8nConfigured())
      throw new Error("BLOQUEO: falta configurar N8N_BASE_URL y N8N_WEBHOOK_TOKEN en el backend");

    const traceId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const { data: run } = await checked(
      context.supabase
        .from("automation_runs")
        .insert({
          organization_id: data.organizationId,
          rule_id: rule.id,
          status: "RUNNING",
          started_at: startedAt,
          trace_id: traceId,
        })
        .select("id")
        .single(),
    );
    if (!run) throw new Error("No se pudo registrar la ejecución; no se enviará a n8n");
    try {
      const result = await dispatchN8nWorkflow(
        slug,
        {
          source: "melano-command-center",
          organization_id: data.organizationId,
          rule_id: rule.id,
          rule_name: rule.name,
          action: rule.action,
          trace_id: traceId,
          triggered_by: context.userId,
          triggered_at: startedAt,
        },
        { test: data.test },
      );
      const outcome = workflowOutcome(result);
      const finishedAt = new Date().toISOString();
      // SKIPPED means no final execution result has been verified, not success.
      const status =
        outcome.state === "success" ? "SUCCESS" : outcome.state === "failed" ? "FAILED" : "SKIPPED";
      await checked(
        context.supabase
          .from("automation_runs")
          .update({
            status,
            finished_at: finishedAt,
            output: outcome.state !== "failed" ? outcome.detail : null,
            error: outcome.state === "failed" ? outcome.detail : null,
          })
          .eq("id", run.id)
          .eq("organization_id", data.organizationId),
      );
      await checked(
        context.supabase
          .from("automation_rules")
          .update({
            last_run_at: finishedAt,
            status:
              outcome.state === "success"
                ? "OK"
                : outcome.state === "failed"
                  ? "ERROR"
                  : "PENDING_VERIFICATION",
            last_result: outcome.state !== "failed" ? outcome.detail : null,
            last_error: outcome.state === "failed" ? outcome.detail : null,
          })
          .eq("id", rule.id)
          .eq("organization_id", data.organizationId),
      );
      await checked(
        context.supabase.from("activity_logs").insert({
          organization_id: data.organizationId,
          actor_type: "human",
          actor_user: context.userId,
          action: `automation.${outcome.state}`,
          entity_type: "automation_rule",
          entity_id: rule.id,
          detail: { workflow: slug, http_status: result.status, test: data.test, run_id: run.id },
          trace_id: traceId,
        }),
      );
      return {
        ok: outcome.state === "success",
        state: outcome.state,
        status: result.status,
        detail: outcome.detail,
        traceId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo de automatización";
      const saved = await context.supabase
        .from("automation_runs")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", run.id)
        .eq("organization_id", data.organizationId);
      if (saved.error) console.error("[automation.run] No se pudo persistir el fallo", traceId);
      throw error;
    }
  });

/** Guarda el workflow de n8n asociado a una regla (sólo el slug, el host sale del backend). */
export const setAutomationWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; ruleId: string; workflow: string }) => {
    if (!input?.organizationId || !input?.ruleId) throw new Error("Parámetros inválidos");
    const workflow = (input.workflow ?? "")
      .trim()
      .replace(/^.*\/webhook(?:-test)?\//, "")
      .replace(/\/+$/, "");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/.test(workflow)) {
      throw new Error("Workflow inválido: usá el path del webhook (letras, números, guiones)");
    }
    return { organizationId: input.organizationId, ruleId: input.ruleId, workflow };
  })
  .handler(async ({ data, context }) => {
    await assertOperator(context as Ctx, data.organizationId);
    const { error } = await context.supabase
      .from("automation_rules")
      .update({ n8n_workflow: data.workflow, status: "READY", last_error: null })
      .eq("id", data.ruleId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "automation.workflow_updated",
      entity_type: "automation_rule",
      entity_id: data.ruleId,
      detail: { workflow: data.workflow },
    });
    return { workflow: data.workflow };
  });

/** Activa o pausa una automatización. */
export const toggleAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; ruleId: string; enabled: boolean }) => {
    if (!input?.organizationId || !input?.ruleId) throw new Error("Parámetros inválidos");
    return { ...input, enabled: !!input.enabled };
  })
  .handler(async ({ data, context }) => {
    await assertOperator(context as Ctx, data.organizationId);
    const { error } = await context.supabase
      .from("automation_rules")
      .update({ enabled: data.enabled })
      .eq("id", data.ruleId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: data.enabled ? "automation.enabled" : "automation.paused",
      entity_type: "automation_rule",
      entity_id: data.ruleId,
      detail: {},
    });
    return { enabled: data.enabled };
  });
