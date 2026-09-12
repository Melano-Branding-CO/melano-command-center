import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { decideCanonicalApproval, updateApprovalEconomics } from "@/lib/approval-economics.functions";

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

type BusinessCase = {
  currency?: string;
  revenue_upside_30d?: number;
  cost_avoidance_30d?: number;
  risk_avoidance_30d?: number;
  implementation_cost?: number;
  confidence?: number;
  expected_value_30d?: number;
  payback_days?: number | null;
  gate?: string;
  evidence_note?: string;
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
  payload?: { business_case?: BusinessCase } | null;
};

type Form = {
  currency: string;
  revenue: string;
  savings: string;
  riskAvoidance: string;
  cost: string;
  confidence: string;
  evidence: string;
};

const EMPTY_FORM: Form = {
  currency: "USD",
  revenue: "0",
  savings: "0",
  riskAvoidance: "0",
  cost: "0",
  confidence: "0.7",
  evidence: "",
};

function money(value: number | undefined, currency = "USD") {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function ApprovalsPage() {
  const { data: org } = useOrg();
  const { data: approvals, isLoading } = useOrgRows<Approval>("approvals", org?.id, { order: "requested_at" });
  const qc = useQueryClient();
  const decide = useServerFn(decideCanonicalApproval);
  const saveEconomics = useServerFn(updateApprovalEconomics);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);

  const ordered = useMemo(() => [...(approvals ?? [])].sort((a, b) =>
    Number(b.payload?.business_case?.expected_value_30d ?? Number.NEGATIVE_INFINITY) -
    Number(a.payload?.business_case?.expected_value_30d ?? Number.NEGATIVE_INFINITY)
  ), [approvals]);

  const pending = ordered.filter((a) => a.status.toLowerCase() === "pending");
  const quantified = pending.filter((a) => a.payload?.business_case);
  const positive = quantified.filter((a) => Number(a.payload?.business_case?.expected_value_30d ?? 0) > 0);
  const totalEv = quantified.reduce((sum, a) => sum + Number(a.payload?.business_case?.expected_value_30d ?? 0), 0);

  function beginEdit(a: Approval) {
    const bc = a.payload?.business_case;
    setEditing(a.id);
    setForm({
      currency: bc?.currency ?? "USD",
      revenue: String(bc?.revenue_upside_30d ?? 0),
      savings: String(bc?.cost_avoidance_30d ?? 0),
      riskAvoidance: String(bc?.risk_avoidance_30d ?? 0),
      cost: String(bc?.implementation_cost ?? 0),
      confidence: String(bc?.confidence ?? 0.7),
      evidence: bc?.evidence_note ?? "",
    });
  }

  async function saveCase(approvalId: string) {
    if (!org?.id) return;
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
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                  <div><dt className="label-caps">EV 30d</dt><dd>{money(bc?.expected_value_30d, bc?.currency)}</dd></div>
                  <div><dt className="label-caps">Revenue</dt><dd>{money(bc?.revenue_upside_30d, bc?.currency)}</dd></div>
                  <div><dt className="label-caps">Costo</dt><dd>{money(bc?.implementation_cost, bc?.currency)}</dd></div>
                  <div><dt className="label-caps">Payback</dt><dd>{bc?.payback_days == null ? "—" : `${bc.payback_days} días`}</dd></div>
                  <div><dt className="label-caps">Confianza</dt><dd>{bc?.confidence == null ? "—" : `${Math.round(bc.confidence * 100)}%`}</dd></div>
                  <div><dt className="label-caps">Impacto</dt><dd>{a.impact ?? "—"}</dd></div>
                  <div><dt className="label-caps">Riesgo</dt><dd>{a.risk ?? "—"}</dd></div>
                  <div><dt className="label-caps">Solicitado</dt><dd>{fmtDate(a.requested_at)}</dd></div>
                </dl>
                {bc?.evidence_note ? <p className="mt-3 text-xs text-muted-foreground">Evidencia: {bc.evidence_note}</p> : null}
                {editing === a.id ? (
                  <div className="mt-4 grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                    {([["Moneda","currency"],["Revenue 30d","revenue"],["Ahorro 30d","savings"],["Riesgo evitado 30d","riskAvoidance"],["Costo implementación","cost"],["Confianza 0-1","confidence"]] as [string, string][]).map(([label,key]) => (
                      <label key={key} className="text-xs text-muted-foreground">{label}<input className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" value={form[key as keyof Form]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>
                    ))}
                    <label className="text-xs text-muted-foreground md:col-span-3">Evidencia / fuente<textarea className="mt-1 min-h-20 w-full rounded border border-border bg-background px-2 py-1 text-foreground" value={form.evidence} onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))} /></label>
                    <div className="md:col-span-3 flex gap-2"><Button size="sm" disabled={busy === a.id} onClick={() => saveCase(a.id)}>Guardar caso económico</Button><Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div>
                  </div>
                ) : null}
                {isPending ? <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => beginEdit(a)}>Caso económico</Button><Button size="sm" disabled={busy === a.id || !bc} onClick={() => act(a, true)}>Aprobar</Button><Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => act(a, false)}>Rechazar</Button></div> : null}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
