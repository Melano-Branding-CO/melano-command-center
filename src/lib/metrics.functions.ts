import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MetricRow = {
  organization_id: string;
  key: string;
  label: string;
  category: string;
  value: number;
  unit: string | null;
  captured_at: string;
  is_demo: boolean;
};

const OPEN_LEAD_STATUSES = ["NUEVO", "CONTACTADO", "CALIFICADO", "NEGOCIACION"];

/**
 * Recalcula las métricas ejecutivas a partir de filas reales ya persistidas
 * (clientes, leads, tareas, aprobaciones, ejecuciones). No inventa valores:
 * si no hay filas de origen, la métrica queda en 0 con su fuente declarada.
 */
export const refreshOperationalMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const orgId = data.organizationId;
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN", "OPERATOR"].includes(member.role)) {
      throw new Error("Sin permisos para recalcular métricas");
    }

    const now = new Date();
    const iso = now.toISOString();
    const since7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    const [clients, leads, tasks, approvals, runs, autoRuns] = await Promise.all([
      context.supabase.from("clients").select("mrr,status,currency").eq("organization_id", orgId),
      context.supabase.from("leads").select("status,budget,phase").eq("organization_id", orgId),
      context.supabase
        .from("tasks")
        .select("status,completed_at")
        .eq("organization_id", orgId)
        .gte("created_at", since30),
      context.supabase.from("approvals").select("status").eq("organization_id", orgId),
      context.supabase
        .from("agent_runs")
        .select("status")
        .eq("organization_id", orgId)
        .gte("started_at", since7),
      context.supabase
        .from("automation_runs")
        .select("status")
        .eq("organization_id", orgId)
        .gte("started_at", since7),
    ]);

    const clientRows = clients.data ?? [];
    const leadRows = leads.data ?? [];
    const taskRows = tasks.data ?? [];
    const approvalRows = approvals.data ?? [];
    const runRows = runs.data ?? [];
    const autoRows = autoRuns.data ?? [];

    const mrr = clientRows.reduce((sum, c) => sum + Number(c.mrr ?? 0), 0);
    const activeClients = clientRows.filter((c) => (c.status ?? "").toUpperCase() !== "CHURN").length;
    const openLeads = leadRows.filter((l) => OPEN_LEAD_STATUSES.includes(l.status));
    const pipeline = openLeads.reduce((sum, l) => sum + Number(l.budget ?? 0), 0);
    const wonLeads = leadRows.filter((l) => l.status === "GANADO").length;
    const conversion = leadRows.length ? (wonLeads / leadRows.length) * 100 : 0;
    const tasksDone = taskRows.filter((t) => t.status === "DONE").length;
    const tasksOpen = taskRows.filter((t) => !["DONE", "FAILED"].includes(t.status)).length;
    const pendingApprovals = approvalRows.filter((a) => a.status === "PENDING").length;
    const runSuccess = runRows.filter((r) => r.status === "SUCCESS").length;
    const runRate = runRows.length ? (runSuccess / runRows.length) * 100 : 0;
    const autoFailed = autoRows.filter((r) => r.status === "FAILED").length;

    const rows: MetricRow[] = [
      ["mrr_total", "MRR contratado", "revenue", mrr, "USD"],
      ["arr_proyectado", "ARR proyectado (MRR x12)", "revenue", mrr * 12, "USD"],
      ["pipeline_abierto", "Pipeline abierto", "revenue", pipeline, "USD"],
      ["clientes_activos", "Clientes activos", "revenue", activeClients, "clientes"],
      ["leads_abiertos", "Leads abiertos", "comercial", openLeads.length, "leads"],
      ["leads_ganados", "Leads ganados", "comercial", wonLeads, "leads"],
      ["conversion_leads", "Conversión de leads", "comercial", Math.round(conversion * 10) / 10, "%"],
      ["tareas_completadas_30d", "Tareas completadas (30 d)", "operacion", tasksDone, "tareas"],
      ["tareas_abiertas_30d", "Tareas abiertas (30 d)", "operacion", tasksOpen, "tareas"],
      ["aprobaciones_pendientes", "Aprobaciones pendientes", "operacion", pendingApprovals, "aprob."],
      [
        "exito_agentes_7d",
        "Éxito de agentes (7 d)",
        "automatizacion",
        Math.round(runRate * 10) / 10,
        "%",
      ],
      ["automatizaciones_fallidas_7d", "Automatizaciones fallidas (7 d)", "automatizacion", autoFailed, "runs"],
    ].map(([key, label, category, value, unit]) => ({
      organization_id: orgId,
      key: key as string,
      label: label as string,
      category: category as string,
      value: Number(value),
      unit: unit as string,
      captured_at: iso,
      is_demo: false,
    }));

    const { error: delError } = await context.supabase
      .from("metrics")
      .delete()
      .eq("organization_id", orgId)
      .in(
        "key",
        rows.map((r) => r.key),
      );
    if (delError) throw new Error(delError.message);

    const { error: insError } = await context.supabase.from("metrics").insert(rows);
    if (insError) throw new Error(insError.message);

    return { count: rows.length, capturedAt: iso };
  });
