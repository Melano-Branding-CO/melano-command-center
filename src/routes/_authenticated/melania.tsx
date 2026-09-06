import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, CalendarClock, FileText, ListChecks } from "lucide-react";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { AUTONOMY_LEVELS, fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/melania")({
  head: () => ({
    meta: [
      { title: "MELANIA — MELANO INC" },
      {
        name: "description",
        content: "CEO digital y orquestadora comercial: estado, últimas reuniones y ejecuciones.",
      },
      { property: "og:title", content: "MELANIA — MELANO INC" },
      {
        property: "og:description",
        content: "Panel de orquestación comercial de MELANIA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MelaniaPage,
});

type Meeting = {
  id: string;
  title: string;
  status: string;
  trigger: string;
  trace_id: string;
  started_at: string | null;
  finished_at: string | null;
  summary: string | null;
};

type AgentRun = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  trace_id: string;
  error: string | null;
};

type Agent = { id: string; name: string; status: string; enabled: boolean };

type Lead = { id: string; stage: string | null; status: string | null };

function MelaniaPage() {
  const { data: org } = useOrg();
  const { data: meetings, isLoading: loadingMeetings } = useOrgRows<Meeting>(
    "executive_meetings",
    org?.id,
    { order: "scheduled_for", limit: 5 },
  );
  const { data: runs } = useOrgRows<AgentRun>("agent_runs", org?.id, {
    order: "started_at",
    limit: 8,
  });
  const { data: agents } = useOrgRows<Agent>("agents", org?.id, {
    order: "sort_order",
    asc: true,
  });
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "created_at" });

  const lastMeeting = (meetings ?? [])[0];
  const activeAgents = (agents ?? []).filter((a) => a.enabled && a.status !== "PAUSED").length;
  const leadsReunion = (leads ?? []).filter((l) => l.stage === "reunion").length;
  const leadsTotal = (leads ?? []).length;
  const failedRuns = (runs ?? []).filter((r) => r.status === "FAILED" || r.error).length;

  return (
    <RoleGate allow={["CEO", "ADMIN"]}>
      <PageHeader
        title="MELANIA · CEO digital"
        subtitle="Orquestadora ejecutiva: reuniones, prioridades, tareas y decisiones con trace auditable."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Estado">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <StatusBadge status={failedRuns > 0 ? "YELLOW" : "GREEN"} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Autonomía L{org?.autonomy_level ?? 0} ·{" "}
            {AUTONOMY_LEVELS[org?.autonomy_level ?? 0] ?? "—"}
          </p>
        </Panel>
        <Panel title="Agentes activos">
          <p className="text-2xl font-semibold text-foreground">{activeAgents}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">de {(agents ?? []).length} totales</p>
        </Panel>
        <Panel title="Pipeline comercial">
          <p className="text-2xl font-semibold text-foreground">{leadsReunion}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            leads en reunión de {leadsTotal} totales
          </p>
        </Panel>
        <Panel title="Ejecuciones con error">
          <p className="text-2xl font-semibold text-foreground">{failedRuns}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">últimas {(runs ?? []).length} corridas</p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Última reunión ejecutiva"
          action={
            <Link
              to="/meetings"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          {loadingMeetings ? (
            <Empty text="Cargando…" />
          ) : !lastMeeting ? (
            <Empty text="SIN DATOS: aún no hay reuniones registradas." />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{lastMeeting.title}</p>
                <StatusBadge status={lastMeeting.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {lastMeeting.summary ?? "Sin resumen disponible."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <CalendarClock className="mr-1 inline size-3" />
                {fmtDate(lastMeeting.started_at)} · trace {lastMeeting.trace_id}
              </p>
              <Link
                to="/meetings/$meetingId"
                params={{ meetingId: lastMeeting.id }}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <FileText className="size-3" /> Abrir brief completo
              </Link>
            </div>
          )}
        </Panel>

        <Panel
          title="Ejecuciones recientes"
          action={
            <Link
              to="/ejecuciones"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Ver historial
            </Link>
          }
        >
          {(runs ?? []).length === 0 ? (
            <Empty text="SIN DATOS: no hay ejecuciones registradas." />
          ) : (
            <ul className="flex flex-col gap-2">
              {(runs ?? []).map((r) => {
                const agent = (agents ?? []).find((a) => a.id === r.agent_id);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {agent?.name ?? "Agente"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {fmtDate(r.started_at)} · {r.trace_id}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Acciones comerciales"
          action={<ListChecks className="size-4 text-muted-foreground" />}
        >
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              to="/leads"
              className="rounded-md border border-border bg-muted px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              Leads · LUXIA
            </Link>
            <Link
              to="/luxia/$stage"
              params={{ stage: "reunion" }}
              className="rounded-md border border-border bg-muted px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              Pipeline LUXIA
            </Link>
            <Link
              to="/clientes"
              className="rounded-md border border-border bg-muted px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              Clientes
            </Link>
            <Link
              to="/decisions"
              className="rounded-md border border-border bg-muted px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              Decisions
            </Link>
          </div>
        </Panel>
      </div>
    </RoleGate>
  );
}
