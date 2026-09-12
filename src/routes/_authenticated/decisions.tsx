import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({
    meta: [
      { title: "Decisions — MELANO INC" },
      {
        name: "description",
        content: "Decisiones propuestas y aprobadas con impacto, riesgo y confianza.",
      },
      { property: "og:title", content: "Decisions — MELANO INC" },
      { property: "og:description", content: "Registro de decisiones del sistema autónomo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DecisionsPage,
});

type Decision = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  risk: string | null;
  expected_impact: string | null;
  confidence: number | null;
  created_at: string | null;
};

function DecisionsPage() {
  const { data: org } = useOrg();
  const { data: decisions, isLoading } = useOrgRows<Decision>("decisions", org?.id, {
    order: "created_at",
  });

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle="Cada decisión con evidencia, riesgo e impacto esperado."
      />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (decisions ?? []).length === 0 ? (
        <Empty text="Sin decisiones registradas." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(decisions ?? []).map((d) => (
            <Panel
              key={d.id}
              title={fmtDate(d.created_at)}
              action={<StatusBadge status={d.status} />}
            >
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={d.priority} />
                <h3 className="text-sm font-semibold text-foreground">{d.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{d.description ?? "—"}</p>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="label-caps">Impacto</dt>
                  <dd className="text-foreground">{d.expected_impact ?? "—"}</dd>
                </div>
                <div>
                  <dt className="label-caps">Riesgo</dt>
                  <dd className="text-foreground">{d.risk ?? "—"}</dd>
                </div>
                <div>
                  <dt className="label-caps">Confianza</dt>
                  <dd className="text-foreground">
                    {d.confidence == null ? "—" : `${Math.round(d.confidence * 100)}%`}
                  </dd>
                </div>
              </dl>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
