import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { N8nWorkflowsPanel } from "@/components/melano/n8n-panel";
import { N8nRunsHistory } from "@/components/melano/n8n-runs-history";
import { McpPanel } from "@/components/melano/mcp-panel";
import { MomentumPanel } from "@/components/melano/momentum";

import { agentMap, fmtDate, todayKey, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runCanonicalBoardNow } from "@/lib/canonical-runtime.functions";

export const Route = createFileRoute("/_authenticated/command")({
  head: () => ({
    meta: [
      { title: "Revenue Command — MELANO INC" },
      {
        name: "description",
        content: "MRR, pipeline, revenue atribuido, ROI, conversión y ejecución comercial verificable.",
      },
      { property: "og:title", content: "Revenue Command — MELANO INC" },
      {
        property: "og:description",
        content: "Control operativo centrado en revenue verificable.",
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

type Ledger = {
  id: string;
  currency: string | null;
  product: string | null;
  realized_amount: number | null;
  mrr_amount: number | null;
  pipeline_amount: number | null;
  ai_revenue_amount: number | null;
  automation_cost_amount: number | null;
  roi_multiple: number | null;
  conversion_rate: number | null;
  attributed_lead_count: number;
  won_count: number;
  attribution_status: string;
  updated_at: string;
};

type AttributionEvent = {
  id: string;
  workflow_id: string | null;
  workflow_name: string | null;
  agent_id: string | null;
  event_type: string;
  currency: string | null;
  realized_revenue: number | null;
  mrr_amount: number | null;
  automation_cost: number | null;
  attribution_weight: number;
  confidence: number;
  updated_at: string;
};

function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function CommandCenter() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const runMeeting = useServerFn(runCanonicalBoardNow);

  useRealtime([
    "tasks",
    "approvals",
    "alerts",
    "automation_rules",
    "leads",
    "revenue_ledger_snapshot",
    "revenue_attribution_events",
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
  const { data: decisions } = useOrgRows<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>("decisions", org?.id, { eq: { status: "PROPOSED" }, order: "created_at", limit: 6 });
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
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "updated_at", limit: 5000 });
  const { data: ledgers } = useOrgRows<Ledger>("revenue_ledger_snapshot", org?.id, {
    order: "updated_at",
    asc: false,
    limit: 10,
  });
  const { data: attributionEvents } = useOrgRows<AttributionEvent>("revenue_attribution_events", org?.id, {
    order: "updated_at",
    asc: false,
    limit: 100,
  });

  const ledger = (ledgers ?? []).find((row) => (row.product ?? "").toLowerCase() === "luxia") ?? ledgers?.[0];
  const currency = ledger?.currency ?? "USD";
  const totalLeads = leads?.length ?? 0;
  const hotLeads = (leads ?? []).filter((lead) => lead.top || (lead.score ?? 0) >= 80).length;
  const costKnown = ledger?.automation_cost_amount !== null && ledger?.automation_cost_amount !== undefined;

  const byActor = new Map<string, { label: string; revenue: number; cost: number; events: number }>();
  for (const event of attributionEvents ?? []) {
    const key = event.agent_id ? `agent:${event.agent_id}` : `workflow:${event.workflow_id ?? "unknown"}`;
    const label = event.agent_id
      ? map.get(event.agent_id)?.name ?? event.agent_id
      : event.workflow_name ?? event.workflow_id ?? "Sin responsable";
    const current = byActor.get(key) ?? { label, revenue: 0, cost: 0, events: 0 };
    current.revenue += Number(event.realized_revenue ?? 0) * Number(event.attribution_weight ?? 1);
    current.cost += Number(event.automation_cost ?? 0);
    current.events += 1;
    byActor.set(key, current);
  }
  const attributionBreakdown = [...byActor.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

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
        subtitle="Cada cifra económica requiere evidencia. Sin revenue ni costos inventados."
        actions={
          <Button onClick={onRunMeeting} disabled={busy || !org?.id}>
            {busy ? "Ejecutando…" : "Ejecutar Revenue Board"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Panel title="MRR">
          <p className="text-xl font-semibold text-foreground">{money(ledger?.mrr_amount, currency)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">LUXIA verificado</p>
        </Panel>
        <Panel title="Pipeline">
          <p className="text-xl font-semibold text-foreground">{money(ledger?.pipeline_amount, currency)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">valor documentado</p>
        </Panel>
        <Panel title="Revenue IA">
          <p className="text-xl font-semibold text-foreground">{money(ledger?.ai_revenue_amount, currency)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">atribución explícita</p>
        </Panel>
        <Panel title="Costo automatización">
          <p className="text-xl font-semibold text-foreground">
            {costKnown ? money(ledger?.automation_cost_amount, currency) : "Sin evidencia"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">no se presume $0</p>
        </Panel>
        <Panel title="ROI">
          <p className="text-xl font-semibold text-foreground">
            {ledger?.roi_multiple === null || ledger?.roi_multiple === undefined
              ? "Pendiente"
              : `${Number(ledger.roi_multiple).toFixed(2)}x`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">requiere costo medido</p>
        </Panel>
        <Panel title="Conversión">
          <p className="text-xl font-semibold text-foreground">
            {ledger?.conversion_rate === null || ledger?.conversion_rate === undefined
              ? "Pendiente"
              : `${(Number(ledger.conversion_rate) * 100).toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{ledger?.won_count ?? 0} cierres verificados</p>
        </Panel>
      </div>

      <div className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Attribution status: <span className="font-medium text-foreground">{ledger?.attribution_status ?? "PENDING_EVIDENCE"}</span>
        {ledger?.updated_at ? ` · actualizado ${new Date(ledger.updated_at).toLocaleString("es-AR")}` : ""}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
                      <dt className="label-caps">Why now</dt>
                      <dd>{t.why_now ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Next action</dt>
                      <dd>{t.next_action ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Owner</dt>
                      <dd>{t.assigned_agent ? (map.get(t.assigned_agent)?.name ?? "—") : "—"}</dd>
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

        <Panel title="Bloqueos de revenue">
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

        <N8nWorkflowsPanel className="lg:col-span-3" />

        <McpPanel className="lg:col-span-3" />

        <N8nRunsHistory className="lg:col-span-3" />

        <Panel title="Alertas">
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
