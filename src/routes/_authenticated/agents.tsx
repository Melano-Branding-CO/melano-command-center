import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge, ModePill } from "@/components/melano/badges";
import { fmtDate, useAgents, useOrg } from "@/lib/melano";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({
    meta: [
      { title: "Agents — MELANO INC" },
      {
        name: "description",
        content:
          "Equipo ejecutivo digital de MELANO INC: objetivo, estado, modo de ejecución y último resultado de cada agente.",
      },
      { property: "og:title", content: "Agents — MELANO INC" },
      { property: "og:description", content: "Agentes ejecutivos de MELANO INC en tiempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentsLayout,
});

function AgentsLayout() {
  const isChild = useRouterState({
    select: (s) => s.location.pathname.split("/").filter(Boolean).length > 1,
  });
  if (isChild) return <Outlet />;
  return <AgentsGrid />;
}

function AgentsGrid() {
  const { data: org } = useOrg();
  const { data: agents, isLoading } = useAgents(org?.id);

  return (
    <>
      <PageHeader title="Agents" subtitle="12 agentes ejecutivos con loop, permisos y evidencia." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (agents ?? []).length === 0 ? (
        <Empty text="Sin agentes configurados." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(agents ?? []).map((a) => (
            <Panel key={a.id} title={a.code} action={<StatusBadge status={a.status} />}>
              <Link
                to="/agents/$agentId"
                params={{ agentId: a.id }}
                className="text-sm font-semibold text-foreground hover:underline"
              >
                {a.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.role}</p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.objective}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ModePill mode={a.execution_mode} />
                <span className="text-[11px] text-muted-foreground">
                  Último run: {fmtDate(a.last_run_at)}
                </span>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
