import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { decideApproval } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/bruno")({
  head: () => ({
    meta: [
      { title: "Bruno — Autoridad Final | MELANO INC" },
      {
        name: "description",
        content:
          "Pantalla de Bruno: las 5 cifras financieras de TITAN y las aprobaciones críticas de Green Gate y visibilidad financiera.",
      },
      { property: "og:title", content: "Bruno — Autoridad Final | MELANO INC" },
      {
        property: "og:description",
        content: "Cifras financieras verificadas y firma humana sobre acciones críticas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrunoPage,
});

type Metric = {
  id: string;
  key: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  captured_at: string | null;
  source_agent: string | null;
};

type Approval = {
  id: string;
  action: string;
  category: string | null;
  reason: string | null;
  impact: string | null;
  risk: string | null;
  status: string;
  requested_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

/** Las 5 cifras que TITAN debe reportar. Sin dato verificado => PENDIENTE. */
const FIGURES = [
  { key: "mrr", label: "MRR", match: /\bmrr\b|ingreso recurrente/i, unit: "USD" },
  { key: "cash", label: "Cash disponible", match: /\bcash\b|caja/i, unit: "USD" },
  { key: "burn", label: "Burn mensual", match: /\bburn\b|gasto mensual/i, unit: "USD" },
  { key: "runway", label: "Runway", match: /\brunway\b/i, unit: "meses" },
  { key: "clients", label: "Clientes activos", match: /client|customer/i, unit: "" },
] as const;

const CRITICAL = /green\s*gate|visibilidad financiera|financial visibility|finanz/i;

function BrunoPage() {
  const { data: org } = useOrg();
  useRealtime(["approvals", "metrics"]);
  const { data: metrics } = useOrgRows<Metric>("metrics", org?.id, { order: "captured_at" });
  const { data: approvals, isLoading } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
  });
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const [busy, setBusy] = useState<string | null>(null);

  const figures = useMemo(
    () =>
      FIGURES.map((f) => {
        const hit = (metrics ?? []).find((m) =>
          f.match.test(`${m.key} ${m.label ?? ""}`),
        );
        return { ...f, metric: hit ?? null };
      }),
    [metrics],
  );

  const pendingCritical = (approvals ?? []).filter(
    (a) => a.status === "PENDING" && CRITICAL.test(`${a.category ?? ""} ${a.action} ${a.reason ?? ""}`),
  );
  const pendingOther = (approvals ?? []).filter(
    (a) => a.status === "PENDING" && !pendingCritical.includes(a),
  );
  const resolved = (approvals ?? []).filter((a) => a.status !== "PENDING").slice(0, 8);

  async function act(approvalId: string, approve: boolean) {
    setBusy(approvalId);
    try {
      await decide({ data: { approvalId, approve } });
      toast.success(approve ? "Aprobado" : "Rechazado");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al decidir");
    } finally {
      setBusy(null);
    }
  }

  function ApprovalCard({ a, critical }: { a: Approval; critical: boolean }) {
    return (
      <Panel
        key={a.id}
        title={critical ? `CRÍTICO · ${a.category ?? "green gate"}` : (a.category ?? "acción")}
        action={<StatusBadge status={a.status} />}
      >
        <h3 className="text-sm font-semibold text-foreground">{a.action}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{a.reason ?? "—"}</p>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="label-caps">Impacto</dt>
            <dd className="text-foreground">{a.impact ?? "—"}</dd>
          </div>
          <div>
            <dt className="label-caps">Riesgo</dt>
            <dd className="text-foreground">{a.risk ?? "—"}</dd>
          </div>
          <div>
            <dt className="label-caps">Solicitado</dt>
            <dd className="text-foreground">{fmtDate(a.requested_at)}</dd>
          </div>
        </dl>
        {a.status === "PENDING" ? (
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={busy === a.id} onClick={() => act(a.id, true)}>
              Aprobar
            </Button>
            <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => act(a.id, false)}>
              Rechazar
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Resuelto {fmtDate(a.decided_at)} · {a.decision_note ?? "sin nota"}
          </p>
        )}
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Bruno"
        subtitle="Autoridad final: cifras financieras de TITAN y firma sobre acciones críticas."
      />

      <section className="mb-8">
        <h2 className="label-caps mb-3">5 cifras financieras · TITAN</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {figures.map((f) => (
            <Panel key={f.key} title={f.label}>
              {f.metric && f.metric.value !== null ? (
                <>
                  <p className="text-2xl font-semibold text-foreground">
                    {f.metric.value}
                    <span className="ml-1 text-sm text-muted-foreground">
                      {f.metric.unit ?? f.unit}
                    </span>
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Verificado {fmtDate(f.metric.captured_at)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-destructive">PENDIENTE</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Sin dato verificado. TITAN no puede estimar.
                  </p>
                </>
              )}
            </Panel>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="label-caps mb-3">
          Aprobaciones críticas · Green Gate y visibilidad financiera
        </h2>
        {isLoading ? (
          <Empty text="Cargando…" />
        ) : pendingCritical.length === 0 ? (
          <Empty text="Nada crítico esperando tu firma." />
        ) : (
          <div className="grid gap-4">
            {pendingCritical.map((a) => (
              <ApprovalCard key={a.id} a={a} critical />
            ))}
          </div>
        )}
      </section>

      {pendingOther.length > 0 ? (
        <section className="mb-8">
          <h2 className="label-caps mb-3">Otras aprobaciones pendientes</h2>
          <div className="grid gap-4">
            {pendingOther.map((a) => (
              <ApprovalCard key={a.id} a={a} critical={false} />
            ))}
          </div>
        </section>
      ) : null}

      {resolved.length > 0 ? (
        <section>
          <h2 className="label-caps mb-3">Historial reciente</h2>
          <div className="grid gap-4">
            {resolved.map((a) => (
              <ApprovalCard key={a.id} a={a} critical={false} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
