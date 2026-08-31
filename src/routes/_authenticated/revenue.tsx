import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue — MELANO INC" },
      { name: "description", content: "Ingresos, pipeline y métricas comerciales verificadas." },
      { property: "og:title", content: "Revenue — MELANO INC" },
      { property: "og:description", content: "Estado comercial de MELANO INC en tiempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RevenuePage,
});

type Metric = {
  id: string;
  key: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  captured_at: string | null;
};

function RevenuePage() {
  const { data: org } = useOrg();
  const { data: metrics, isLoading } = useOrgRows<Metric>("metrics", org?.id, {
    order: "captured_at",
  });
  const revenue = (metrics ?? []).filter((m) =>
    /revenue|mrr|arr|ventas|pipeline|cash/i.test(`${m.key} ${m.label ?? ""}`),
  );

  return (
    <>
      <PageHeader title="Revenue" subtitle="Dinero real, no proyecciones sin evidencia." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : revenue.length === 0 ? (
        <Empty text="SIN DATOS: no hay métricas de revenue verificadas." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {revenue.map((m) => (
            <Panel key={m.id} title={m.label ?? m.key}>
              <p className="text-2xl font-semibold text-foreground">
                {m.value ?? "—"}
                <span className="ml-1 text-sm text-muted-foreground">{m.unit ?? ""}</span>
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">{fmtDate(m.captured_at)}</p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
