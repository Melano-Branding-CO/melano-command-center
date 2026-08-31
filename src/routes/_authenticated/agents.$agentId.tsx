import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge, ModePill } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRowById } from "@/lib/melano-queries";
import { runAgentNow } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Agente — MELANO INC" },
      { name: "description", content: "Detalle, permisos y últimas ejecuciones del agente." },
      { property: "og:title", content: "Agente — MELANO INC" },
      { property: "og:description", content: "Detalle ejecutivo del agente de MELANO INC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentDetail,
});

type AgentRow = {
  id: string;
  code: string;
  name: string;
  role: string;
  objective: string;
  status: string;
  execution_mode: string;
  last_run_at: string | null;
  last_result: string | null;
  last_error: string | null;
  system_prompt: string;
  context: string | null;
  execution_loop: string | null;
  stop_conditions: string | null;
  failure_handling: string | null;
  measurable_outcome: string | null;
};

type Run = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  trace_id: string | null;
  tokens: number | null;
  estimated_cost: number | null;
  tools_used: unknown;
  output: Record<string, unknown> | null;
};

function durationOf(r: Run) {
  if (!r.started_at || !r.finished_at) return "—";
  const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

function AgentDetail() {
  const { agentId } = Route.useParams();
  const { data: org } = useOrg();
  const { data: agent, isLoading } = useRowById<AgentRow>("agents", agentId);
  const { data: runs } = useOrgRows<Run>("agent_runs", org?.id, {
    eq: { agent_id: agentId },
    order: "started_at",
    limit: 10,
  });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = useServerFn(runAgentNow);

  async function execute() {
    if (!org?.id) return;
    setBusy(true);
    try {
      await run({ data: { agentId, organizationId: org.id } });
      toast.success("Agente ejecutado");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error ejecutando el agente");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Empty text="Cargando…" />;
  if (!agent) return <Empty text="Agente no encontrado." />;

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={`${agent.code} · ${agent.role}`}
        actions={
          <>
            <Link to="/agents" className="text-sm text-muted-foreground hover:underline">
              Volver
            </Link>
            <Button onClick={execute} disabled={busy}>
              {busy ? "Ejecutando…" : "Ejecutar ahora"}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Estado" action={<StatusBadge status={agent.status} />}>
          <p className="text-sm text-muted-foreground">{agent.objective}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ModePill mode={agent.execution_mode} />
            <span className="text-[11px] text-muted-foreground">
              Último run: {fmtDate(agent.last_run_at)}
            </span>
          </div>
          <p className="mt-3 text-sm text-foreground">{agent.last_result ?? "—"}</p>
          {agent.last_error ? (
            <p className="mt-2 text-sm text-destructive">{agent.last_error}</p>
          ) : null}
        </Panel>
        <Panel title="Últimas ejecuciones">
          {(runs ?? []).length === 0 ? (
            <Empty text="Sin ejecuciones registradas." />
          ) : (
            <ul className="space-y-3 text-sm">
              {(runs ?? []).map((r) => (
                <li key={r.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{fmtDate(r.started_at)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>trace {r.trace_id ? r.trace_id.slice(0, 8) : "—"}</span>
                    <span>{r.tokens ?? 0} tokens</span>
                    <span>US$ {(r.estimated_cost ?? 0).toFixed(4)}</span>
                    <span>{durationOf(r)}</span>
                  </div>
                  {r.error ? (
                    <p className="mt-2 text-xs text-destructive">{r.error}</p>
                  ) : r.output ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Ver output real
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
                        {JSON.stringify(r.output, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Prompt operativo real">
          <div className="space-y-3 text-sm">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-[11px] leading-relaxed">
              {agent.system_prompt}
            </pre>
            {(
              [
                ["Contexto", agent.context],
                ["Ciclo de ejecución", agent.execution_loop],
                ["Condiciones de parada", agent.stop_conditions],
                ["Manejo de fallos", agent.failure_handling],
                ["Resultado medible", agent.measurable_outcome],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              ) : null,
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
