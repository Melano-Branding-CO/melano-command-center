import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { fmtDate, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboards")({
  head: () => ({
    meta: [
      { title: "Dashboards — MELANO INC" },
      {
        name: "description",
        content:
          "KPIs en tiempo real del día, por agente y por producto del sistema autónomo de MELANO INC.",
      },
      { property: "og:title", content: "Dashboards — MELANO INC" },
      {
        property: "og:description",
        content: "Indicadores operativos verificados por día, agente y producto.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardsPage,
});

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_agent: string | null;
  product_id: string | null;
  created_at: string;
  completed_at: string | null;
  is_today_priority: boolean;
  today_date: string | null;
};

type Run = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  tokens: number | null;
  estimated_cost: number | null;
};

type Decision = { id: string; status: string; source_agent: string | null; created_at: string };
type Approval = { id: string; status: string; agent_id: string | null; requested_at: string };
type Product = { id: string; name: string; code: string; status: string; priority: string };
type Alert = { id: string; severity: string; status: string; created_at: string };

const isToday = (value?: string | null) =>
  !!value && new Date(value).toDateString() === new Date().toDateString();

function DashboardsPage() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  useRealtime(["tasks", "agent_runs", "decisions", "approvals", "alerts", "products"]);

  const { data: tasks, isLoading } = useOrgRows<Task>("tasks", org?.id, {
    order: "created_at",
    limit: 500,
  });
  const { data: runs } = useOrgRows<Run>("agent_runs", org?.id, {
    order: "started_at",
    limit: 500,
  });
  const { data: decisions } = useOrgRows<Decision>("decisions", org?.id, {
    order: "created_at",
    limit: 300,
  });
  const { data: approvals } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
    limit: 300,
  });
  const { data: products } = useOrgRows<Product>("products", org?.id, { order: "priority", asc: true });
  const { data: alerts } = useOrgRows<Alert>("alerts", org?.id, { order: "created_at", limit: 200 });

  const allTasks = tasks ?? [];
  const allRuns = runs ?? [];
  const runsToday = allRuns.filter((r) => isToday(r.started_at));
  const tasksToday = allTasks.filter((t) => isToday(t.created_at));
  const completedToday = allTasks.filter((t) => isToday(t.completed_at));
  const openBlocked = allTasks.filter((t) => t.status === "BLOCKED");
  const pendingApprovals = (approvals ?? []).filter((a) => a.status === "PENDING");
  const decisionsToday = (decisions ?? []).filter((d) => isToday(d.created_at));
  const openAlerts = (alerts ?? []).filter((a) => a.status === "OPEN");

  const okRuns = runsToday.filter((r) => r.status === "SUCCESS").length;
  const failedRuns = runsToday.filter((r) => r.status === "FAILED").length;
  const successRate = runsToday.length ? Math.round((okRuns / runsToday.length) * 100) : null;
  const tokensToday = runsToday.reduce((acc, r) => acc + (r.tokens ?? 0), 0);
  const costToday = runsToday.reduce((acc, r) => acc + Number(r.estimated_cost ?? 0), 0);

  const agentRows = (agents as Agent[] | undefined ?? []).map((a) => {
    const rs = allRuns.filter((r) => r.agent_id === a.id);
    const rsToday = rs.filter((r) => isToday(r.started_at));
    const ok = rsToday.filter((r) => r.status === "SUCCESS").length;
    const ts = allTasks.filter((t) => t.assigned_agent === a.id);
    return {
      agent: a,
      runsToday: rsToday.length,
      okRate: rsToday.length ? Math.round((ok / rsToday.length) * 100) : null,
      tokens: rsToday.reduce((acc, r) => acc + (r.tokens ?? 0), 0),
      cost: rsToday.reduce((acc, r) => acc + Number(r.estimated_cost ?? 0), 0),
      openTasks: ts.filter((t) => !["DONE", "FAILED"].includes(t.status)).length,
      doneTasks: ts.filter((t) => t.status === "DONE").length,
      decisions: (decisions ?? []).filter((d) => d.source_agent === a.id).length,
    };
  });

  const productRows = (products ?? []).map((p) => {
    const ts = allTasks.filter((t) => t.product_id === p.id);
    const done = ts.filter((t) => t.status === "DONE").length;
    return {
      product: p,
      total: ts.length,
      done,
      blocked: ts.filter((t) => t.status === "BLOCKED").length,
      running: ts.filter((t) => ["RUNNING", "READY", "REVIEW"].includes(t.status)).length,
      progress: ts.length ? Math.round((done / ts.length) * 100) : null,
    };
  });

  const unassigned = allTasks.filter((t) => !t.product_id && t.status !== "DONE").length;

  return (
    <>
      <PageHeader
        title="Dashboards"
        subtitle="KPIs del día, por agente y por producto. Datos reales, actualizados en tiempo real."
      />

      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Ejecuciones hoy" value={runsToday.length} hint={`${okRuns} OK · ${failedRuns} fallidas`} />
            <Kpi
              label="Tasa de éxito hoy"
              value={successRate === null ? "SIN DATOS" : `${successRate}%`}
              tone={successRate === null ? "muted" : successRate >= 80 ? "good" : "warn"}
            />
            <Kpi label="Tareas creadas hoy" value={tasksToday.length} hint={`${completedToday.length} completadas`} />
            <Kpi
              label="Bloqueos abiertos"
              value={openBlocked.length}
              tone={openBlocked.length > 0 ? "warn" : "good"}
            />
            <Kpi
              label="Aprobaciones pendientes"
              value={pendingApprovals.length}
              tone={pendingApprovals.length > 0 ? "warn" : "good"}
            />
            <Kpi label="Decisiones hoy" value={decisionsToday.length} />
            <Kpi
              label="Alertas abiertas"
              value={openAlerts.length}
              tone={openAlerts.length > 0 ? "bad" : "good"}
            />
            <Kpi
              label="Consumo IA hoy"
              value={tokensToday > 0 ? `${tokensToday.toLocaleString("es-AR")} tk` : "SIN DATOS"}
              hint={tokensToday > 0 ? `USD ${costToday.toFixed(4)} estimado` : undefined}
            />
          </section>

          <Panel title="KPIs por agente">
            {agentRows.length === 0 ? (
              <Empty text="Sin agentes configurados." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <Th>Agente</Th>
                      <Th>Estado</Th>
                      <Th right>Runs hoy</Th>
                      <Th right>Éxito</Th>
                      <Th right>Tareas abiertas</Th>
                      <Th right>Tareas DONE</Th>
                      <Th right>Decisiones</Th>
                      <Th right>Tokens hoy</Th>
                      <Th>Última ejecución</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((r) => (
                      <tr key={r.agent.id} className="border-b border-border/60 last:border-0">
                        <Td>
                          <Link
                            to="/agents/$agentId"
                            params={{ agentId: r.agent.id }}
                            className="font-medium text-foreground hover:underline"
                          >
                            {r.agent.name}
                          </Link>
                        </Td>
                        <Td>
                          <StatusBadge status={r.agent.status} />
                        </Td>
                        <Td right>{r.runsToday}</Td>
                        <Td right>{r.okRate === null ? "—" : `${r.okRate}%`}</Td>
                        <Td right>{r.openTasks}</Td>
                        <Td right>{r.doneTasks}</Td>
                        <Td right>{r.decisions}</Td>
                        <Td right>{r.tokens ? r.tokens.toLocaleString("es-AR") : "—"}</Td>
                        <Td>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(r.agent.last_run_at)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="KPIs por producto">
            {productRows.length === 0 ? (
              <Empty text="Sin productos registrados." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {productRows.map((r) => (
                  <div key={r.product.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={r.product.priority} />
                      <span className="text-sm font-medium text-foreground">{r.product.name}</span>
                      <StatusBadge status={r.product.status} />
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${r.progress ?? 0}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      <Mini label="Tareas" value={r.total} />
                      <Mini label="Done" value={r.done} />
                      <Mini label="En curso" value={r.running} />
                      <Mini label="Bloqueadas" value={r.blocked} />
                    </dl>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {r.total === 0 ? "SIN DATOS: sin tareas asociadas." : `Avance ${r.progress}%`}
                    </p>
                  </div>
                ))}
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  {unassigned} tareas abiertas sin producto asignado.
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  tone?: "muted" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    muted: "text-foreground",
    good: "text-success",
    warn: "text-warning",
    bad: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="label-caps">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn("label-caps py-2 pr-3 font-medium", right && "text-right")}>{children}</th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={cn("py-2 pr-3 text-foreground", right && "text-right tabular-nums")}>
      {children}
    </td>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
