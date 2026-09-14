import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — MELANO INC" },
      { name: "description", content: "Log completo de acciones humanas y de agentes con trace_id." },
      { property: "og:title", content: "Activity — MELANO INC" },
      { property: "og:description", content: "Auditoría en vivo del sistema autónomo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityPage,
});

type Log = {
  id: string;
  action: string;
  actor_type: string;
  entity_type: string | null;
  created_at: string | null;
  trace_id: string | null;
};

function ActivityPage() {
  const { data: org } = useOrg();
  const { data: logs, isLoading } = useOrgRows<Log>("activity_logs", org?.id, {
    order: "created_at",
    limit: 200,
  });

  return (
    <>
      <PageHeader title="Activity" subtitle="Toda acción queda registrada con su trazabilidad." />
      <Panel title="Últimos eventos">
        {isLoading ? (
          <Empty text="Cargando…" />
        ) : (logs ?? []).length === 0 ? (
          <Empty text="Sin actividad registrada." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</span>
                <span className="flex-1 truncate text-foreground">{l.action}</span>
                <span className="text-[11px] uppercase text-muted-foreground">
                  {l.actor_type} · {l.entity_type ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
