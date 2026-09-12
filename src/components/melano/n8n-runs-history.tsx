import { Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { cn } from "@/lib/utils";

type AutomationRule = { id: string; name: string; n8n_workflow: string | null };

type AutomationRun = {
  id: string;
  rule_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  trace_id: string | null;
  error: string | null;
  output: string | null;
};

function durationLabel(run: AutomationRun): string {
  if (!run.finished_at) return "en curso";
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Historial real de ejecuciones de n8n (automation_runs) con estado, trace y fecha.
 * No depende de disparar un run end-to-end: lee lo ya persistido en la base.
 */
export function N8nRunsHistory({
  className,
  limit = 20,
}: {
  className?: string | undefined;
  limit?: number | undefined;
}) {
  const { data: org } = useOrg();
  useRealtime(["automation_runs", "automation_rules"]);

  const { data: rules } = useOrgRows<AutomationRule>("automation_rules", org?.id, {
    order: "created_at",
  });
  const { data: runs, isLoading, error } = useOrgRows<AutomationRun>("automation_runs", org?.id, {
    order: "started_at",
    limit,
  });

  const ruleName = new Map((rules ?? []).map((r) => [r.id, r.n8n_workflow ?? r.name]));

  return (
    <Panel title="n8n · Historial de ejecuciones" className={cn(className)}>
      {isLoading ? (
        <Empty text="Cargando ejecuciones…" />
      ) : error ? (
        <Empty
          text={`No se pudo leer el historial: ${error instanceof Error ? error.message : "error"}`}
        />
      ) : (runs ?? []).length === 0 ? (
        <Empty text="Sin ejecuciones registradas todavía." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Workflow</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Inicio</th>
                <th className="py-2 pr-3 font-medium">Duración</th>
                <th className="py-2 font-medium">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="align-top">
                  <td className="py-2 pr-3">
                    <span className="text-foreground">
                      {ruleName.get(run.rule_id) ?? "Workflow eliminado"}
                    </span>
                    {run.error ? (
                      <p className="line-clamp-2 text-[11px] text-destructive">{run.error}</p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmtDate(run.started_at)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{durationLabel(run)}</td>
                  <td className="py-2 font-mono text-[11px] text-muted-foreground">
                    {run.trace_id ? run.trace_id.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
