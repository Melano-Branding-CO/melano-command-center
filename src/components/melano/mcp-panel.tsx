import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { runDecisionViaMcp, runTaskViaMcp } from "@/lib/melano.functions";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  trace_id: string | null;
  updated_at: string | null;
  created_at: string;
};

type Decision = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  requires_approval: boolean | null;
  created_at: string;
};

const RUNNABLE_TASKS = ["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "FAILED", "REVIEW"];

/**
 * Panel MCP: ejecuta tareas y decisiones contra el workflow real de n8n
 * usando el mismo puente que el endpoint /mcp (run + log con trace_id).
 */
export function McpPanel({ className }: { className?: string }) {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const runTask = useServerFn(runTaskViaMcp);
  const runDecision = useServerFn(runDecisionViaMcp);

  useRealtime(["tasks", "decisions", "automation_runs", "activity_logs"]);

  const { data: tasks } = useOrgRows<Task>("tasks", org?.id, { order: "created_at", limit: 30 });
  const { data: decisions } = useOrgRows<Decision>("decisions", org?.id, {
    order: "created_at",
    limit: 20,
  });

  const runnableTasks = (tasks ?? []).filter((t) => RUNNABLE_TASKS.includes(t.status)).slice(0, 6);
  const runnableDecisions = (decisions ?? []).filter((d) => d.status !== "EXECUTED").slice(0, 6);

  async function onRunTask(task: Task) {
    if (!org?.id) return;
    setBusy(task.id);
    try {
      const res = await runTask({ data: { organizationId: org.id, taskId: task.id } });
      toast.success(`Tarea enviada a ${res.workflow ?? "n8n"} · trace ${res.traceId?.slice(0, 8)}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error ejecutando en n8n");
    } finally {
      setBusy(null);
    }
  }

  async function onRunDecision(decision: Decision) {
    if (!org?.id) return;
    setBusy(decision.id);
    try {
      const res = await runDecision({ data: { organizationId: org.id, decisionId: decision.id } });
      toast.success(
        res.executed
          ? `Decisión ejecutada en ${res.workflow ?? "n8n"} · trace ${res.traceId?.slice(0, 8)}`
          : "Requiere aprobación de Bruno: se envió el aviso a n8n",
      );
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error ejecutando en n8n");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Panel MCP · Ejecución en n8n"
      className={cn(className)}
      action={<span className="text-[11px] text-muted-foreground">endpoint /mcp · credencial API</span>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="label-caps mb-2">Tareas</p>
          {runnableTasks.length === 0 ? (
            <Empty text="Sin tareas ejecutables." />
          ) : (
            <ul className="space-y-2">
              {runnableTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.priority ?? "—"} · {fmtDate(t.updated_at ?? t.created_at)} · trace{" "}
                      {t.trace_id ? t.trace_id.slice(0, 8) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === t.id}
                      onClick={() => onRunTask(t)}
                    >
                      {busy === t.id ? "Ejecutando…" : "Ejecutar"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="label-caps mb-2">Decisiones</p>
          {runnableDecisions.length === 0 ? (
            <Empty text="Sin decisiones pendientes de ejecución." />
          ) : (
            <ul className="space-y-2">
              {runnableDecisions.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.priority ?? "—"} ·{" "}
                      {d.requires_approval ? "requiere aprobación de Bruno" : "ejecución directa"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => onRunDecision(d)}
                    >
                      {busy === d.id ? "Enviando…" : d.requires_approval ? "Notificar" : "Ejecutar"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
