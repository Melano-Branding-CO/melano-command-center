import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { refreshOperationalMetrics } from "@/lib/metrics.functions";

export const Route = createFileRoute("/_authenticated/metrics")({
  head: () => ({
    meta: [
      { title: "Metrics — MELANO INC" },
      { name: "description", content: "Métricas verificadas del negocio y del sistema autónomo." },
      { property: "og:title", content: "Metrics — MELANO INC" },
      {
        property: "og:description",
        content: "Indicadores clave con fuente y fecha de verificación.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetricsPage,
});

type Metric = {
  id: string;
  key: string;
  label: string | null;
  category: string | null;
  value: number | null;
  unit: string | null;
  captured_at: string | null;
};

function MetricsPage() {
  const { data: org } = useOrg();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = useServerFn(refreshOperationalMetrics);
  const { data: metrics, isLoading } = useOrgRows<Metric>("metrics", org?.id, {
    order: "captured_at",
  });

  async function onRefresh() {
    if (!org?.id) return;
    setBusy(true);
    try {
      const res = await refresh({ data: { organizationId: org.id } });
      toast.success(`${res.count} métricas recalculadas desde la base real`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron recalcular las métricas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Metrics"
        subtitle="Calculadas desde clientes, leads, tareas, aprobaciones y ejecuciones reales."
        actions={
          <Button onClick={onRefresh} disabled={busy || !org?.id}>
            {busy ? "Recalculando…" : "Recalcular métricas"}
          </Button>
        }
      />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (metrics ?? []).length === 0 ? (
        <Empty text="SIN DATOS: usá “Recalcular métricas” para generarlas desde la base." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(metrics ?? []).map((m) => (
            <Panel key={m.id} title={m.label ?? m.key}>
              <p className="text-2xl font-semibold text-foreground">
                {m.value ?? "—"}
                <span className="ml-1 text-sm text-muted-foreground">{m.unit ?? ""}</span>
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {m.category ?? "—"} · {fmtDate(m.captured_at)}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
