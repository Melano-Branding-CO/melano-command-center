import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader, Panel, RoleGate } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runAgentNow } from "@/lib/melano.functions";
import { runCanonicalBoardNow } from "@/lib/canonical-runtime.functions";

export const Route = createFileRoute("/_authenticated/agents-control")({
  head: () => ({
    meta: [
      { title: "Control de Agentes — MELANO INC" },
      { name: "description", content: "Cockpit operativo para ejecutar y auditar MELANO AGENT OS desde el Command Center." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentsControlRoute,
});

type Run = {
  id: string;
  agent_id: string | null;
  status: string;
  trace_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

type Approval = {
  id: string;
  action: string;
  status: string;
  risk: string | null;
  trace_id: string | null;
  requested_at: string | null;
};

function AgentsControlRoute() {
  return (
    <RoleGate allow={["CEO", "ADMIN", "OPERATOR"]}>
      <AgentsControl />
    </RoleGate>
  );
}

function AgentsControl() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const { data: runs } = useOrgRows<Run>("agent_runs", org?.id, {
    order: "started_at",
    asc: false,
    limit: 30,
  });
  const { data: approvals } = useOrgRows<Approval>("approvals", org?.id, {
    eq: { status: "PENDING" },
    order: "requested_at",
    asc: false,
    limit: 20,
  });
  const qc = useQueryClient();
  const runAgent = useServerFn(runAgentNow);
  const runBoard = useServerFn(runCanonicalBoardNow);
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);

  useRealtime(["agents", "agent_runs", "meetings", "approvals", "activity_logs", "tasks", "decisions"]);

  const lastRunByAgent = useMemo(() => {
    const map = new Map<string, Run>();
    for (const run of runs ?? []) {
      if (run.agent_id && !map.has(run.agent_id)) map.set(run.agent_id, run);
    }
    return map;
  }, [runs]);

  async function executeAgent(agent: Agent) {
    if (!org?.id) return;
    setBusyAgent(agent.id);
    try {
      const res = await runAgent({ data: { agentId: agent.id, organizationId: org.id } });
      toast.success(`Agente ejecutado · trace ${res.traceId.slice(0, 8)}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar el agente");
    } finally {
      setBusyAgent(null);
    }
  }

  async function executeBoard() {
    if (!org?.id) return;
    setBoardBusy(true);
    try {
      const res = await runBoard({ data: { tenantId: org.id } });
      toast.success(`Board enviado a n8n · trace ${res.traceId.slice(0, 8)}`);
      window.setTimeout(() => qc.invalidateQueries(), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar la Junta");
    } finally {
      setBoardBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Control de Agentes"
        subtitle="Command Center → ejecución real → trace_id → persistencia → auditoría. Sin estados simulados."
        actions={
          <Button onClick={executeBoard} disabled={!org?.id || boardBusy}>
            {boardBusy ? "Ejecutando Junta…" : "Ejecutar Junta ahora"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Panel title="Agentes configurados">
          <p className="text-2xl font-semibold text-foreground">{agents?.length ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">estado leído desde Supabase</p>
        </Panel>
        <Panel title="Runs recientes">
          <p className="text-2xl font-semibold text-foreground">{runs?.length ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">últimos 30 registros</p>
        </Panel>
        <Panel title="Aprobaciones pendientes">
          <p className="text-2xl font-semibold text-foreground">{approvals?.length ?? 0}</p>
          <Link to="/approvals" className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground">
            Revisar approvals →
          </Link>
        </Panel>
      </div>

      <Panel title="Junta IA · ejecución por agente">
        {(agents ?? []).length === 0 ? (
          <Empty text="No hay agentes persistidos para este tenant." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {(agents as Agent[]).map((agent) => {
              const lastRun = lastRunByAgent.get(agent.id);
              const disabled = !agent.enabled || agent.status === "PAUSED" || busyAgent === agent.id;
              return (
                <article key={agent.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Último run: {fmtDate(lastRun?.started_at ?? agent.last_run_at)}</p>
                    <p className="font-mono">trace {lastRun?.trace_id ? lastRun.trace_id.slice(0, 8) : "—"}</p>
                    {lastRun?.error ? <p className="text-destructive">{lastRun.error}</p> : null}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => executeAgent(agent)} disabled={disabled}>
                      {busyAgent === agent.id ? "Ejecutando…" : "Ejecutar"}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/agents/$agentId" params={{ agentId: agent.id }}>Detalle / logs</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Últimas ejecuciones">
          {(runs ?? []).length === 0 ? (
            <Empty text="Sin ejecuciones registradas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(runs ?? []).slice(0, 10).map((run) => (
                <li key={run.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{run.trace_id?.slice(0, 12) ?? "sin-trace"}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDate(run.started_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Approval Gate">
          {(approvals ?? []).length === 0 ? (
            <Empty text="Nada esperando autorización humana." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(approvals ?? []).map((approval) => (
                <li key={approval.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground">{approval.action}</span>
                    <StatusBadge status={approval.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Riesgo {approval.risk ?? "—"} · trace {approval.trace_id?.slice(0, 8) ?? "—"}</p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" className="mt-3">
            <Link to="/approvals">Abrir Aprobaciones</Link>
          </Button>
        </Panel>
      </div>
    </>
  );
}
