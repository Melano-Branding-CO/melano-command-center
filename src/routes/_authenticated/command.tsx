import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { agentMap, fmtDate, todayKey, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runMeetingNow, runN8nAutomation } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/command")({
  head: () => ({
    meta: [
      { title: "Command Center — MELANO INC" },
      {
        name: "description",
        content:
          "Estado ejecutivo en vivo: Top 3 del día, agentes, decisiones pendientes, aprobaciones y alertas de MELANO INC.",
      },
      { property: "og:title", content: "Command Center — MELANO INC" },
      {
        property: "og:description",
        content: "Estado ejecutivo en vivo del sistema autónomo de MELANO INC.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommandCenter,
});

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  why_now: string | null;
  next_action: string | null;
  success_metric: string | null;
  assigned_agent: string | null;
  deadline: string | null;
};

function CommandCenter() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [n8nBusy, setN8nBusy] = useState<string | null>(null);
  const runMeeting = useServerFn(runMeetingNow);
  const runWorkflow = useServerFn(runN8nAutomation);

  useRealtime([
    "tasks",
    "decisions",
    "approvals",
    "alerts",
    "automation_rules",
    "metrics",
    "agents",
  ]);

  const today = todayKey(org?.timezone ?? undefined);
  const { data: todayTasks, isLoading: loadingToday } = useOrgRows<Task>("tasks", org?.id, {
    eq: { is_today_priority: true, today_date: today },
    order: "priority",
    asc: true,
  });
  const { data: blocked } = useOrgRows<Task>("tasks", org?.id, {
    eq: { status: "BLOCKED" },
    order: "updated_at",
  });
  const { data: decisions } = useOrgRows<{ id: string; title: string; status: string; priority: string }>(
    "decisions",
    org?.id,
    { eq: { status: "PROPOSED" }, order: "created_at", limit: 6 },
  );
  const { data: approvals } = useOrgRows<{ id: string; action: string; risk: string | null }>(
    "approvals",
    org?.id,
    { eq: { status: "PENDING" }, order: "requested_at" },
  );
  const { data: alerts } = useOrgRows<{ id: string; title: string; severity: string }>(
    "alerts",
    org?.id,
    { eq: { status: "OPEN" }, order: "created_at" },
  );
  const { data: automations } = useOrgRows<{
    id: string;
    name: string;
    status: string;
    enabled: boolean;
    n8n_workflow: string | null;
    n8n_webhook_url: string | null;
    last_run_at: string | null;
    last_result: string | null;
    last_error: string | null;
    next_run_at: string | null;
  }>("automation_rules", org?.id, { order: "created_at" });
  const { data: automationRuns } = useOrgRows<{
    id: string;
    rule_id: string;
    status: string;
    started_at: string;
    trace_id: string | null;
    error: string | null;
  }>("automation_runs", org?.id, { order: "started_at", limit: 40 });
  const { data: revenueMetrics } = useOrgRows<{
    id: string;
    label: string;
    value: number;
    unit: string | null;
    captured_at: string;
  }>("metrics", org?.id, { eq: { category: "revenue" }, order: "captured_at", limit: 4 });

  async function onRunMeeting() {
    if (!org?.id) return;
    setBusy(true);
    try {
      const res = await runMeeting({ data: { organizationId: org.id } });
      toast.success(`Reunión ejecutada · trace ${res.traceId.slice(0, 8)}`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar la reunión");
    } finally {
      setBusy(false);
    }
  }

  async function onRunWorkflow(ruleId: string, label: string) {
    if (!org?.id) return;
    setN8nBusy(ruleId);
    try {
      await runWorkflow({ data: { organizationId: org.id, ruleId } });
      toast.success(`Workflow ${label} ejecutado en n8n`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error llamando a n8n");
    } finally {
      setN8nBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Command Center"
        subtitle="Todo lo que ves sale de la base de datos real. Sin datos inventados."
        actions={
          <Button onClick={onRunMeeting} disabled={busy || !org?.id}>
            {busy ? "Ejecutando…" : "Ejecutar reunión ahora"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Hoy — Top 3"
          className="lg:col-span-2"
          action={
            <Link to="/today" className="text-xs text-muted-foreground hover:text-foreground">
              Ver detalle
            </Link>
          }
        >
          {loadingToday ? (
            <Empty text="Cargando prioridades desde la base…" />
          ) : (todayTasks ?? []).length === 0 ? (
            <Empty text="Sin prioridades definidas hoy. Ejecutá la reunión ejecutiva para generarlas." />
          ) : (
            <ul className="space-y-3">
              {(todayTasks ?? []).slice(0, 3).map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <span className="text-sm font-medium text-foreground">{t.title}</span>
                  </div>
                  <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="label-caps">Why now</dt>
                      <dd>{t.why_now ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Next action</dt>
                      <dd>{t.next_action ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Owner</dt>
                      <dd>{t.assigned_agent ? map.get(t.assigned_agent)?.name ?? "—" : "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Success metric</dt>
                      <dd>{t.success_metric ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Revenue">
          {(revenueMetrics ?? []).length === 0 ? (
            <Empty text="Sin métricas de revenue registradas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(revenueMetrics ?? []).map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-semibold text-foreground">
                    {m.value} {m.unit ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Agentes">
          {(agents ?? []).length === 0 ? (
            <Empty text="Sin agentes configurados." />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {(agents ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <Link
                    to="/agents/$agentId"
                    params={{ agentId: a.id }}
                    className="truncate text-foreground hover:underline"
                  >
                    {a.name}
                  </Link>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Decisiones pendientes">
          {(decisions ?? []).length === 0 ? (
            <Empty text="Sin decisiones propuestas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(decisions ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <Link
                    to="/decisions"
                    className="truncate text-foreground hover:underline"
                  >
                    {d.title}
                  </Link>
                  <PriorityBadge priority={d.priority} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Aprobaciones humanas">
          {(approvals ?? []).length === 0 ? (
            <Empty text="Nada esperando autorización." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(approvals ?? []).map((a) => (
                <li key={a.id}>
                  <Link to="/approvals" className="text-foreground hover:underline">
                    {a.action}
                  </Link>
                  <p className="text-xs text-muted-foreground">Riesgo: {a.risk ?? "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bloqueos">
          {(blocked ?? []).length === 0 ? (
            <Empty text="Sin bloqueos registrados." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(blocked ?? []).map((t) => (
                <li key={t.id} className="text-foreground">
                  {t.title}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="n8n · Workflows"
          className="lg:col-span-3"
          action={
            <Link to="/automations" className="text-xs text-muted-foreground hover:text-foreground">
              Configurar en Automations
            </Link>
          }
        >
          {(automations ?? []).length === 0 ? (
            <Empty text="Sin workflows de n8n configurados." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(automations ?? []).map((r) => {
                const lastRuns = (automationRuns ?? [])
                  .filter((x) => x.rule_id === r.id)
                  .slice(0, 2);
                return (
                  <div key={r.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {r.n8n_workflow ?? "sin workflow"} ·{" "}
                          {r.n8n_webhook_url ? "webhook conectado" : "sin webhook"}
                        </p>
                      </div>
                      <StatusBadge status={r.enabled ? "ACTIVE" : "PAUSED"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Último: {fmtDate(r.last_run_at)}</span>
                      <span>Próximo: {fmtDate(r.next_run_at)}</span>
                      <span>Estado: {r.status ?? "—"}</span>
                    </div>
                    {r.last_error ? (
                      <p className="mt-2 line-clamp-2 text-[11px] text-destructive">{r.last_error}</p>
                    ) : r.last_result ? (
                      <p className="mt-2 line-clamp-2 text-[11px] text-foreground">{r.last_result}</p>
                    ) : null}
                    {lastRuns.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        {lastRuns.map((x) => (
                          <li key={x.id} className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={x.status} />
                            <span>{fmtDate(x.started_at)}</span>
                            <span>trace {x.trace_id ? x.trace_id.slice(0, 8) : "—"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!r.n8n_webhook_url || !r.enabled || n8nBusy === r.id}
                        onClick={() => onRunWorkflow(r.id, r.n8n_workflow ?? r.name)}
                      >
                        {n8nBusy === r.id ? "Ejecutando…" : "Ejecutar en n8n"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Alertas">
          {(alerts ?? []).length === 0 ? (
            <Empty text="Sin alertas abiertas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(alerts ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{a.title}</span>
                  <StatusBadge status={a.severity} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
