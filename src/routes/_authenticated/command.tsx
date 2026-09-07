import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { N8nWorkflowsPanel } from "@/components/melano/n8n-panel";
import { MiniCommandConsole } from "@/components/melano/mini-command-console";
import { agentMap, todayKey, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runCanonicalBoardNow } from "@/lib/canonical-runtime.functions";

export const Route = createFileRoute("/_authenticated/command")({
  head: () => ({
    meta: [
      { title: "Revenue Command — MELANO INC" },
      {
        name: "description",
        content: "Caja, pipeline, cierres, bloqueos y automatización comercial de MELANO INC.",
      },
      { property: "og:title", content: "Revenue Command — MELANO INC" },
      {
        property: "og:description",
        content: "Control operativo centrado en revenue real.",
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

type Lead = {
  id: string;
  score: number | null;
  top: boolean | null;
};

function CommandCenter() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const runMeeting = useServerFn(runCanonicalBoardNow);

  useRealtime(["tasks", "approvals", "alerts", "automation_rules", "metrics", "leads"]);

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
  const { data: revenueMetrics } = useOrgRows<{
    id: string;
    label: string;
    value: number;
    unit: string | null;
    captured_at: string;
  }>("metrics", org?.id, { eq: { category: "revenue" }, order: "captured_at", limit: 4 });
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "updated_at", limit: 5000 });

  const totalLeads = leads?.length ?? 0;
  const hotLeads = (leads ?? []).filter((lead) => lead.top || (lead.score ?? 0) >= 80).length;

  async function onRunMeeting() {
    if (!org?.id) return;
    setBusy(true);
    try {
      const res = await runMeeting({ data: { tenantId: org.id } });
      toast.success(`Board aceptado por n8n · trace ${res.traceId.slice(0, 8)}`);
      window.setTimeout(() => qc.invalidateQueries(), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar el Board");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Revenue Command"
        subtitle="Solo caja, pipeline, cierres, bloqueos y automatización. Sin dashboards de relleno."
        actions={
          <Button onClick={onRunMeeting} disabled={busy || !org?.id}>
            {busy ? "Ejecutando…" : "Ejecutar Revenue Board"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Leads">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold text-foreground">{totalLeads}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Hot / score alto</span>
              <span className="text-xl font-semibold text-foreground">{hotLeads}</span>
            </div>
            <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground">
              Abrir leads →
            </Link>
          </div>
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

        <Panel title="Aprobaciones que bloquean ejecución">
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

        <Panel
          title="Hoy — Top 3 de impacto"
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
            <Empty text="Sin prioridades definidas hoy. Ejecutá Revenue Board." />
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
                      <dt className="label-caps">Por qué ahora</dt>
                      <dd>{t.why_now ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Próxima acción</dt>
                      <dd>{t.next_action ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Responsable</dt>
                      <dd>{t.assigned_agent ? map.get(t.assigned_agent)?.name ?? "—" : "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Métrica de éxito</dt>
                      <dd>{t.success_metric ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bloqueos de revenue">
          {(blocked ?? []).length === 0 ? (
            <Empty text="Sin bloqueos registrados." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(blocked ?? []).map((t) => (
                <li key={t.id} className="text-foreground">{t.title}</li>
              ))}
            </ul>
          )}
        </Panel>

        <N8nWorkflowsPanel className="lg:col-span-3" />

        <Panel title="Alertas críticas">
          {(alerts ?? []).length === 0 ? (
            <Empty text="Sin alertas abiertas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(alerts ?? []).slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{a.title}</span>
                  <StatusBadge status={a.severity} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <MiniCommandConsole />
    </>
  );
}
