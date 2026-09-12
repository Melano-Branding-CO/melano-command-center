import { createServerFn } from "@tanstack/react-start";

export type PublicStats = {
  organization: { name: string; tagline: string | null } | null;
  updatedAt: string;
  totals: {
    tasks: number;
    tasksDone: number;
    decisions: number;
    approvals: number;
    approvalsResolved: number;
    leads: number;
    clients: number;
    clientsActive: number;
    agentRuns: number;
    agentRunsSuccess: number;
  };
  tasksByStatus: { name: string; value: number }[];
  decisionsByStatus: { name: string; value: number }[];
  approvalsByStatus: { name: string; value: number }[];
  leadsByPhase: { name: string; value: number }[];
  clientsByStage: { name: string; value: number }[];
  activityByDay: { day: string; tareas: number; decisiones: number }[];
};

function tally(rows: { [k: string]: unknown }[], field: string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = String(r[field] ?? "—");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Estadísticas agregadas y anónimas para la página pública.
 * Solo devuelve conteos: nunca nombres, emails, teléfonos ni contenido de registros.
 */
export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id,name,tagline,created_at")
      .order("created_at")
      .limit(1);
    const org = orgs?.[0] ?? null;

    const empty: PublicStats = {
      organization: org ? { name: org.name, tagline: org.tagline } : null,
      updatedAt: new Date().toISOString(),
      totals: {
        tasks: 0,
        tasksDone: 0,
        decisions: 0,
        approvals: 0,
        approvalsResolved: 0,
        leads: 0,
        clients: 0,
        clientsActive: 0,
        agentRuns: 0,
        agentRunsSuccess: 0,
      },
      tasksByStatus: [],
      decisionsByStatus: [],
      approvalsByStatus: [],
      leadsByPhase: [],
      clientsByStage: [],
      activityByDay: [],
    };

    if (!org) return empty;

    const [tasks, decisions, approvals, leads, clients, runs] = await Promise.all([
      supabaseAdmin.from("tasks").select("status,created_at").eq("organization_id", org.id),
      supabaseAdmin.from("decisions").select("status,created_at").eq("organization_id", org.id),
      supabaseAdmin.from("approvals").select("status").eq("organization_id", org.id),
      supabaseAdmin.from("leads").select("phase").eq("organization_id", org.id),
      supabaseAdmin.from("clients").select("status,luxia_stage").eq("organization_id", org.id),
      supabaseAdmin.from("agent_runs").select("status").eq("organization_id", org.id),
    ]);

    const taskRows = tasks.data ?? [];
    const decisionRows = decisions.data ?? [];
    const approvalRows = approvals.data ?? [];
    const leadRows = leads.data ?? [];
    const clientRows = (clients.data ?? []) as { status: string; luxia_stage: string }[];
    const runRows = runs.data ?? [];

    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      days.push(d.toISOString().slice(0, 10));
    }
    const activityByDay = days.map((day) => ({
      day: day.slice(5),
      tareas: taskRows.filter((t) => String(t.created_at ?? "").slice(0, 10) === day).length,
      decisiones: decisionRows.filter((d) => String(d.created_at ?? "").slice(0, 10) === day)
        .length,
    }));

    return {
      organization: { name: org.name, tagline: org.tagline },
      updatedAt: new Date().toISOString(),
      totals: {
        tasks: taskRows.length,
        tasksDone: taskRows.filter((t) => t.status === "DONE").length,
        decisions: decisionRows.length,
        approvals: approvalRows.length,
        approvalsResolved: approvalRows.filter((a) => a.status !== "PENDING").length,
        leads: leadRows.length,
        clients: clientRows.length,
        clientsActive: clientRows.filter((c) => c.status === "ACTIVO").length,
        agentRuns: runRows.length,
        agentRunsSuccess: runRows.filter((r) => r.status === "SUCCESS").length,
      },
      tasksByStatus: tally(taskRows, "status"),
      decisionsByStatus: tally(decisionRows, "status"),
      approvalsByStatus: tally(approvalRows, "status"),
      leadsByPhase: tally(leadRows, "phase"),
      clientsByStage: tally(clientRows, "luxia_stage"),
      activityByDay,
    };
  },
);
