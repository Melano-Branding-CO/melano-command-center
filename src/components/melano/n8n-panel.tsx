import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runN8nAutomation } from "@/lib/melano.functions";
import { cn } from "@/lib/utils";

type AutomationRule = {
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
};

type AutomationRun = {
  id: string;
  rule_id: string;
  status: string;
  started_at: string;
  trace_id: string | null;
  error: string | null;
};

/**
 * Panel reutilizable de workflows n8n: estado, último/próximo run,
 * últimas ejecuciones con trace y botón "Ejecutar en n8n".
 * Se usa en /command, /ceo y /operador-dashboard.
 */
export function N8nWorkflowsPanel({ className }: { className?: string }) {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const runWorkflow = useServerFn(runN8nAutomation);

  useRealtime(["automation_rules", "automation_runs"]);

  const { data: automations } = useOrgRows<AutomationRule>("automation_rules", org?.id, {
    order: "created_at",
  });
  const { data: automationRuns } = useOrgRows<AutomationRun>("automation_runs", org?.id, {
    order: "started_at",
    limit: 40,
  });

  async function onRunWorkflow(ruleId: string, label: string) {
    if (!org?.id) return;
    setBusy(ruleId);
    try {
      await runWorkflow({ data: { organizationId: org.id, ruleId } });
      toast.success(`Workflow ${label} ejecutado en n8n`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error llamando a n8n");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="n8n · Workflows"
      className={className}
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
            const lastRuns = (automationRuns ?? []).filter((x) => x.rule_id === r.id).slice(0, 2);
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
                    disabled={!r.n8n_webhook_url || !r.enabled || busy === r.id}
                    onClick={() => onRunWorkflow(r.id, r.n8n_workflow ?? r.name)}
                  >
                    {busy === r.id ? "Ejecutando…" : "Ejecutar en n8n"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
