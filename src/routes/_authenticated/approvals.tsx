import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { decideApproval } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · Profit Gate — MELANO INC" },
      { name: "description", content: "Aprobaciones priorizadas por impacto económico verificable." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

type Approval = {
  id: string;
  action: string;
  category: string | null;
  reason: string | null;
  impact: string | null;
  risk: string | null;
  status: string;
  requested_at: string | null;
};

function ApprovalsPage() {
  const { data: org } = useOrg();
  const { data: approvals, isLoading } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
  });
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(approvalId: string, approve: boolean) {
    setBusy(approvalId);
    try {
      await saveEconomics({ data: {
        tenantId: org.id,
        approvalId,
        currency: form.currency,
        revenueUpside30d: Number(form.revenue),
        costAvoidance30d: Number(form.savings),
        riskAvoidance30d: Number(form.riskAvoidance),
        implementationCost: Number(form.cost),
        confidence: Number(form.confidence),
        evidenceNote: form.evidence,
      }});
      toast.success("Caso económico guardado");
      setEditing(null);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el caso económico");
    } finally {
      setBusy(null);
    }
  }

  async function act(a: Approval, approve: boolean) {
    if (!org?.id) return;
    const bc = a.payload?.business_case;
    if (approve && !bc) {
      toast.error("Falta caso económico. Cuantificá antes de aprobar.");
      return;
    }
    if (approve && Number(bc?.expected_value_30d ?? 0) <= 0 && !window.confirm("EV <= 0. ¿Confirmás la excepción?")) return;
    setBusy(a.id);
    try {
      await decide({ data: { tenantId: org.id, approvalId: a.id, approve } });
      toast.success(approve ? "Aprobado y registrado para ejecución" : "Rechazado");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al decidir");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Approvals · Profit Gate" subtitle="Capital, riesgo y retorno esperado antes de autorizar." />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Panel title="Pendientes"><p className="text-2xl font-semibold">{pending.length}</p></Panel>
        <Panel title="Cuantificadas"><p className="text-2xl font-semibold">{quantified.length}</p></Panel>
        <Panel title="EV positivo"><p className="text-2xl font-semibold">{positive.length}</p></Panel>
        <Panel title="EV 30d agregado"><p className="text-2xl font-semibold">{money(totalEv)}</p></Panel>
      </div>
      {isLoading ? <Empty text="Cargando…" /> : ordered.length === 0 ? <Empty text="Nada esperando autorización." /> : (
        <div className="grid gap-4">
          {ordered.map((a) => {
            const bc = a.payload?.business_case;
            const isPending = a.status.toLowerCase() === "pending";
            return (
              <Panel key={a.id} title={a.category ?? "critical"} action={<StatusBadge status={a.status} />}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="text-sm font-semibold text-foreground">{a.action}</h3><p className="mt-1 text-sm text-muted-foreground">{a.reason ?? "—"}</p></div>
                  <StatusBadge status={bc ? (bc.gate === "POSITIVE_EV" ? "ACTIVE" : "BLOCKED") : "PENDING_CONFIG"} />
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
