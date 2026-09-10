import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/meetings/")({
  head: () => ({
    meta: [
      { title: "Meetings — MELANO INC" },
      {
        name: "description",
        content: "Reuniones ejecutivas de las 06:00 con brief consolidado por MELANIA.",
      },
      { property: "og:title", content: "Meetings — MELANO INC" },
      { property: "og:description", content: "Historial del comité ejecutivo autónomo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  summary: string | null;
};

function MeetingsPage() {
  const { data: org } = useOrg();
  const { data: meetings, isLoading } = useOrgRows<Meeting>("executive_meetings", org?.id, {
    order: "started_at",
  });
  const { data: outputs } = useOrgRows<{ meeting_id: string }>("meeting_outputs", org?.id, {});
  const { data: decisions } = useOrgRows<{ meeting_id: string | null }>("decisions", org?.id, {});

  const countBy = (rows: { meeting_id?: string | null }[] | undefined, id: string) =>
    (rows ?? []).filter((r) => r.meeting_id === id).length;

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Comité ejecutivo diario 06:00 (America/Argentina/Buenos_Aires). Abrí una reunión para leer la respuesta de cada agente y los casos derivados."
      />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (meetings ?? []).length === 0 ? (
        <Empty text="Sin reuniones registradas todavía." />
      ) : (
        <div className="grid gap-4">
          {(meetings ?? []).map((m) => (
            <Panel
              key={m.id}
              title={fmtDate(m.started_at)}
              action={<StatusBadge status={m.status} />}
            >
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {m.summary ?? "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>Finalizada: {fmtDate(m.finished_at)}</span>
                <span>{countBy(outputs, m.id)} respuestas de agentes</span>
                <span>{countBy(decisions, m.id)} decisiones</span>
                <Link
                  to="/meetings/$meetingId"
                  params={{ meetingId: m.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  Leer reunión completa →
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
