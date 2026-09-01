import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runTaskInN8n } from "@/lib/melano.functions";
import { useOrgRows } from "@/lib/melano-queries";
import { fmtDateTime } from "@/lib/melano";

export type TaskN8nLog = {
  id: string;
  action: string;
  entity_id: string | null;
  trace_id: string | null;
  created_at: string;
  detail: {
    task?: string;
    rule?: string;
    workflow?: string | null;
    status?: string;
    error?: string | null;
    output?: string;
  } | null;
};

/** Botón de ejecución de una tarea en su workflow de n8n. */
export function RunTaskInN8nButton({
  organizationId,
  taskId,
  size = "sm",
}: {
  organizationId?: string;
  taskId: string;
  size?: "sm" | "default";
}) {
  const run = useServerFn(runTaskInN8n);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!organizationId) return;
    setBusy(true);
    try {
      const res = await run({ data: { organizationId, taskId } });
      toast.success(`Tarea enviada a n8n · ${res.rule}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
      qc.invalidateQueries({ queryKey: ["automation_runs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar en n8n");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size={size} disabled={!organizationId || busy} onClick={onClick}>
      {busy ? "Ejecutando…" : "Ejecutar en n8n"}
    </Button>
  );
}

/** Hook de logs de ejecución en n8n de tareas (activity_logs · n8n.task). */
export function useTaskN8nLogs(orgId?: string, limit = 50) {
  return useOrgRows<TaskN8nLog>("activity_logs", orgId, {
    eq: { action: "n8n.task" },
    order: "created_at",
    limit,
  });
}

/** Lista compacta de ejecuciones en n8n. */
export function TaskN8nLogList({ logs }: { logs: TaskN8nLog[] }) {
  return (
    <ul className="divide-y divide-border">
      {logs.map((l) => {
        const ok = l.detail?.status === "SUCCESS";
        return (
          <li key={l.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={ok ? "text-emerald-400" : "text-destructive"}>
                {ok ? "OK" : "ERROR"}
              </span>
              <span className="flex-1 truncate text-foreground">{l.detail?.task ?? "Tarea"}</span>
              <span className="text-xs text-muted-foreground">
                {l.detail?.workflow ?? l.detail?.rule ?? "n8n"} · {fmtDateTime(l.created_at)}
              </span>
            </div>
            {l.detail?.error ? (
              <p className="mt-1 text-xs text-destructive">{l.detail.error}</p>
            ) : l.detail?.output ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{l.detail.output}</p>
            ) : null}
            {l.trace_id ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">trace {l.trace_id}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
