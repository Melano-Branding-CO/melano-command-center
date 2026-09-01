import { useQuery } from "@tanstack/react-query";
import { Panel, Empty } from "@/components/melano/shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/melano";
import { useRealtime } from "@/lib/melano-queries";

type LogRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  trace_id: string | null;
  created_at: string;
  detail: Record<string, unknown> | null;
};

const ACTIONS = [
  "n8n.task.run",
  "n8n.decision.run",
  "n8n.decision.approval_required",
] as const;

const LABEL: Record<string, string> = {
  "n8n.task.run": "Tarea → n8n",
  "n8n.decision.run": "Decisión → n8n",
  "n8n.decision.approval_required": "Decisión → aprobación",
};

/**
 * Logs de ejecuciones disparadas desde el endpoint MCP hacia n8n.
 * Filtra por reunión cuando se pasa meetingId.
 */
export function McpN8nLog({
  orgId,
  meetingId,
  limit = 12,
}: {
  orgId?: string;
  meetingId?: string;
  limit?: number;
}) {
  useRealtime(["activity_logs"]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["activity_logs", "mcp-n8n", orgId, meetingId, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id,action,entity_type,entity_id,trace_id,created_at,detail")
        .eq("organization_id", orgId!)
        .in("action", ACTIONS as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(meetingId ? 100 : limit);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LogRow[];
      const filtered = meetingId
        ? rows.filter((r) => (r.detail?.["meeting_id"] as string | null) === meetingId)
        : rows;
      return filtered.slice(0, limit);
    },
  });

  return (
    <Panel title="Ejecuciones MCP · n8n">
      {isLoading ? (
        <Empty text="Cargando ejecuciones…" />
      ) : error ? (
        <Empty text={`No se pudieron leer los logs: ${error instanceof Error ? error.message : "error"}`} />
      ) : (data ?? []).length === 0 ? (
        <Empty text="Sin ejecuciones disparadas desde MCP todavía." />
      ) : (
        <ul className="divide-y divide-border/60">
          {(data ?? []).map((log) => {
            const d = log.detail ?? {};
            const ok = d["status"] === "SUCCESS";
            return (
              <li key={log.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {LABEL[log.action] ?? log.action}
                    {d["title"] ? ` · ${String(d["title"])}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtDate(log.created_at)} · workflow {String(d["workflow"] ?? d["rule"] ?? "—")} · trace{" "}
                    {log.trace_id?.slice(0, 8) ?? "—"}
                  </p>
                  {d["error"] ? (
                    <p className="text-[11px] text-destructive">{String(d["error"])}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    ok
                      ? "border-primary/40 text-primary"
                      : "border-destructive/40 text-destructive"
                  }`}
                >
                  {String(d["status"] ?? "—")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
