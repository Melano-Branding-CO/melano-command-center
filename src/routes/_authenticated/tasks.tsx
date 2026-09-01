import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { agentMap, fmtDate, useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import {
  RunTaskInN8nButton,
  TaskN8nLogList,
  useTaskN8nLogs,
} from "@/components/melano/task-n8n";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — MELANO INC" },
      { name: "description", content: "Backlog ejecutivo con owner, prioridad, estado y evidencia." },
      { property: "og:title", content: "Tasks — MELANO INC" },
      { property: "og:description", content: "Tareas del sistema autónomo de MELANO INC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigned_agent: string | null;
  next_action: string | null;
  deadline: string | null;
};

function TasksPage() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  useRealtime(["tasks", "activity_logs"]);
  const { data: tasks, isLoading } = useOrgRows<Task>("tasks", org?.id, {
    order: "created_at",
  });
  const { data: logs } = useTaskN8nLogs(org?.id, 30);


  return (
    <>
      <PageHeader title="Tasks" subtitle="Todo lo que el sistema decidió ejecutar." />
      <Panel title="Backlog">
        {isLoading ? (
          <Empty text="Cargando…" />
        ) : (tasks ?? []).length === 0 ? (
          <Empty text="Sin tareas registradas." />
        ) : (
          <ul className="divide-y divide-border">
            {(tasks ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <span className="flex-1 truncate text-foreground">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t.assigned_agent ? (map.get(t.assigned_agent)?.code ?? "—") : "—"} ·{" "}
                  {fmtDate(t.deadline)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
