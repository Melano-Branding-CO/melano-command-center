import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/metrics")({
  head: () => ({
    meta: [
      { title: "Metrics — MELANO INC" },
      { name: "description", content: "Métricas verificadas del negocio y del sistema autónomo." },
      { property: "og:title", content: "Metrics — MELANO INC" },
      { property: "og:description", content: "Indicadores clave con fuente y fecha de verificación." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetricsPage,
});

type Metric = {
  id: string;
  key: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  captured_at: string | null;
  source: string | null;
};

function MetricsPage() {
  const { data: org } = useOrg();
  const { data: metrics, isLoading } = useOrgRows<Metric>("metrics", org?.id, {
    order: "captured_at",
  });

  return (
    <>
      <PageHeader title="Metrics" subtitle="Sin dato verificado, el sistema dice SIN DATOS." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (metrics ?? []).length === 0 ? (
        <Empty text="SIN DATOS: todavía no hay métricas cargadas." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(metrics ?? []).map((m) => (
            <Panel key={m.id} title={m.label ?? m.key}>
              <p className="text-2xl font-semibold text-foreground">
                {m.value ?? "—"}
                <span className="ml-1 text-sm text-muted-foreground">{m.unit ?? ""}</span>
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {m.source ?? "—"} · {fmtDate(m.captured_at)}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
