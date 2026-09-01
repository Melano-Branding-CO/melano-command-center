import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { agentMap, fmtDate, todayKey, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { McpN8nLog } from "@/components/melano/mcp-n8n-log";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — MELANO INC" },
      {
        name: "description",
        content: "Las tres prioridades del día definidas por MELANIA con owner y métrica de éxito.",
      },
      { property: "og:title", content: "Today — MELANO INC" },
      { property: "og:description", content: "Top 3 del día del sistema autónomo MELANO INC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TodayPage,
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
  description: string | null;
  result: string | null;
  error: string | null;
  completed_at: string | null;
  trace_id: string | null;
};

function TodayPage() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  useRealtime(["tasks"]);
  const today = todayKey(org?.timezone ?? undefined);
  const { data: tasks, isLoading, error } = useOrgRows<Task>("tasks", org?.id, {
    eq: { is_today_priority: true, today_date: today },
    order: "priority",
    asc: true,
  });

  return (
    <>
      <PageHeader title="Today" subtitle={`Máximo 3 prioridades. Nada más. · ${today}`} />
      {isLoading ? (
        <Empty text="Cargando prioridades desde la base…" />
      ) : error ? (
        <Empty text={`No se pudieron leer las prioridades: ${error instanceof Error ? error.message : "error desconocido"}`} />
      ) : (tasks ?? []).length === 0 ? (
        <Empty text="Sin prioridades para hoy. Ejecutá la reunión ejecutiva desde el Command Center." />
      ) : (
        <div className="grid gap-4">
          {(tasks ?? []).slice(0, 3).map((t, i) => (
            <Panel key={t.id} title={`Prioridad ${i + 1}`}>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Objetivo" value={t.description} />
                <Field label="Why now" value={t.why_now} />
                <Field
                  label="Owner"
                  value={t.assigned_agent ? (map.get(t.assigned_agent)?.name ?? null) : null}
                />
                <Field label="Next action" value={t.next_action} />
                <Field label="Success metric" value={t.success_metric} />
                <Field label="Deadline" value={t.deadline ? fmtDate(t.deadline) : null} />
              </dl>
              {t.result ? (
                <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
                  <p className="label-caps">
                    Outcome{t.completed_at ? ` · ${fmtDate(t.completed_at)}` : ""}
                    {t.trace_id ? ` · trace ${t.trace_id.slice(0, 8)}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{t.result}</p>
                </div>
              ) : null}
              {t.error ? (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="label-caps">Error</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{t.error}</p>
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      )}

      <div className="mt-4">
        <McpN8nLog orgId={org?.id} />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
