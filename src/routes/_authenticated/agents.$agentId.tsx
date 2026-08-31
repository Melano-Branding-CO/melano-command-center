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
};

type Run = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

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
            <ul className="space-y-2 text-sm">
              {(runs ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{fmtDate(r.started_at)}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
