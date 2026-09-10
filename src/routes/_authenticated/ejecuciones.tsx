import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { agentMap, fmtDate, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/ejecuciones")({
  head: () => ({
    meta: [
      { title: "Ejecuciones — MELANO INC" },
      {
        name: "description",
        content: "Avance real de reuniones, tareas y automatizaciones por día y por agente.",
      },
      { property: "og:title", content: "Ejecuciones — MELANO INC" },
      {
        property: "og:description",
        content:
          "Dashboard operativo de ejecuciones: reuniones, tareas, agentes y automatizaciones.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EjecucionesPage,
});

type MeetingRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  finished_at: string | null;
};
type TaskRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  assigned_agent: string | null;
};
type AgentRunRow = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  estimated_cost: number | null;
  tokens: number | null;
};
type AutomationRunRow = {
  id: string;
  rule_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};
type RuleRow = { id: string; name: string; n8n_workflow: string | null };

const DAYS = 14;

function dayKey(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toISOString().slice(0, 10);
}

function lastDays(n: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Barra horizontal simple con proporción sobre el máximo de la serie. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-border/60">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EjecucionesPage() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const byAgent = agentMap(agents as Agent[] | undefined);
  useRealtime(["executive_meetings", "tasks", "agent_runs", "automation_runs"]);

  const { data: meetings, isLoading: lm } = useOrgRows<MeetingRow>("executive_meetings", org?.id, {
    order: "created_at",
    limit: 200,
  });
  const { data: tasks, isLoading: lt } = useOrgRows<TaskRow>("tasks", org?.id, {
    order: "created_at",
    limit: 500,
  });
  const { data: agentRuns, isLoading: la } = useOrgRows<AgentRunRow>("agent_runs", org?.id, {
    order: "started_at",
    limit: 500,
  });
  const { data: autoRuns } = useOrgRows<AutomationRunRow>("automation_runs", org?.id, {
    order: "started_at",
    limit: 300,
  });
  const { data: rules } = useOrgRows<RuleRow>("automation_rules", org?.id, {
    order: "created_at",
    asc: true,
  });

  const loading = lm || lt || la;
  const days = lastDays(DAYS);
  const inWindow = (iso?: string | null) => {
    const k = dayKey(iso);
    return !!k && days.includes(k);
  };

  const meetingsW = (meetings ?? []).filter((m) => inWindow(m.created_at));
  const tasksDoneW = (tasks ?? []).filter((t) => inWindow(t.completed_at));
  const runsW = (agentRuns ?? []).filter((r) => inWindow(r.started_at));
  const autoW = (autoRuns ?? []).filter((r) => inWindow(r.started_at));

  const perDay = days.map((d) => ({
    day: d,
    meetings: meetingsW.filter((m) => dayKey(m.created_at) === d).length,
    tasks: tasksDoneW.filter((t) => dayKey(t.completed_at) === d).length,
    runs: runsW.filter((r) => dayKey(r.started_at) === d).length,
    autos: autoW.filter((r) => dayKey(r.started_at) === d).length,
  }));
  const maxDay = Math.max(1, ...perDay.map((d) => d.meetings + d.tasks + d.runs + d.autos));

  const perAgent = (agents ?? [])
    .map((a) => {
      const runs = runsW.filter((r) => r.agent_id === a.id);
      const ok = runs.filter((r) => r.status === "SUCCESS").length;
      const failed = runs.filter((r) => r.status === "FAILED").length;
      const tareas = tasksDoneW.filter((t) => t.assigned_agent === a.id).length;
      const cost = runs.reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0);
      return { id: a.id, code: a.code, name: a.name, runs: runs.length, ok, failed, tareas, cost };
    })
    .filter((r) => r.runs > 0 || r.tareas > 0)
    .sort((x, y) => y.runs + y.tareas - (x.runs + x.tareas));
  const maxAgent = Math.max(1, ...perAgent.map((a) => a.runs + a.tareas));

  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]));
  const okRuns = runsW.filter((r) => r.status === "SUCCESS").length;
  const successRate = runsW.length ? Math.round((okRuns / runsW.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Ejecuciones"
        subtitle={`Avance real de los últimos ${DAYS} días · reuniones, tareas, agentes y automatizaciones.`}
      />

      {loading ? (
        <Empty text="Cargando ejecuciones…" />
      ) : (
        <div className="grid gap-4">
          <Panel title="Resumen del período">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Reuniones" value={meetingsW.length} hint="ejecutivas ejecutadas" />
              <Stat label="Tareas completadas" value={tasksDoneW.length} hint="con completed_at" />
              <Stat
                label="Runs de agentes"
                value={runsW.length}
                hint={`${successRate}% éxito · ${runsW.length - okRuns} con error`}
              />
              <Stat
                label="Automatizaciones"
                value={autoW.length}
                hint="ejecuciones n8n / internas"
              />
            </div>
          </Panel>

          <Panel title="Avance por día">
            {perDay.every((d) => d.meetings + d.tasks + d.runs + d.autos === 0) ? (
              <Empty text="Sin ejecuciones registradas en el período." />
            ) : (
              <ul className="space-y-2">
                {perDay.map((d) => {
                  const total = d.meetings + d.tasks + d.runs + d.autos;
                  return (
                    <li key={d.day} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{d.day}</span>
                        <span className="text-xs text-muted-foreground">
                          {d.meetings} reuniones · {d.tasks} tareas · {d.runs} runs · {d.autos}{" "}
                          automatizaciones
                        </span>
                        <span className="w-8 text-right text-foreground">{total}</span>
                      </div>
                      <div className="mt-1">
                        <Bar value={total} max={maxDay} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Avance por agente">
            {perAgent.length === 0 ? (
              <Empty text="Ningún agente ejecutó en el período." />
            ) : (
              <ul className="space-y-2">
                {perAgent.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex-1 truncate text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{a.code}</span>{" "}
                        {a.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.runs} runs · {a.ok} ok · {a.failed} error · {a.tareas} tareas
                        {a.cost > 0 ? ` · USD ${a.cost.toFixed(4)}` : ""}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Bar value={a.runs + a.tareas} max={maxAgent} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Últimas reuniones">
              {meetingsW.length === 0 ? (
                <Empty text="Sin reuniones en el período." />
              ) : (
                <ul className="divide-y divide-border">
                  {meetingsW.slice(0, 10).map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                      <StatusBadge status={m.status} />
                      <span className="flex-1 truncate text-foreground">{m.title}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Últimas automatizaciones">
              {autoW.length === 0 ? (
                <Empty text="Sin ejecuciones de automatizaciones." />
              ) : (
                <ul className="divide-y divide-border">
                  {autoW.slice(0, 10).map((r) => {
                    const rule = ruleById.get(r.rule_id);
                    return (
                      <li key={r.id} className="py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          <span className="flex-1 truncate text-foreground">
                            {rule?.n8n_workflow ?? rule?.name ?? "Automatización"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(r.started_at)}
                          </span>
                        </div>
                        {r.error ? (
                          <p className="mt-1 text-xs text-destructive">{r.error}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
