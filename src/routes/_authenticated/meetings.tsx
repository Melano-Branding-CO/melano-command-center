import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useTenantRows } from "@/integrations/supabase/canonical";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — MELANO INC" },
      { name: "description", content: "Reuniones ejecutivas de las 06:00 con brief consolidado por MELANIA." },
      { property: "og:title", content: "Meetings — MELANO INC" },
      { property: "og:description", content: "Historial del comité ejecutivo autónomo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  summary: Record<string, unknown> | null;
  trace_id: string;
};

function MeetingsPage() {
  const { data: org } = useOrg();
  const { data: meetings, isLoading } = useTenantRows<Meeting>("meeting_runs", org?.id, {
    order: "started_at",
  });

  return (
    <>
      <PageHeader title="Meetings" subtitle="Comité ejecutivo diario 06:00 (America/Argentina/Buenos_Aires)." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (meetings ?? []).length === 0 ? (
        <Empty text="Sin reuniones registradas todavía." />
      ) : (
        <div className="grid gap-4">
          {(meetings ?? []).map((m) => (
            <Panel key={m.id} title={fmtDate(m.started_at)} action={<StatusBadge status={m.status} />}>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{m.summary ? JSON.stringify(m.summary, null, 2) : "—"}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Finalizada: {fmtDate(m.completed_at)}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
