import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import {
  decideApproval,
  notifyApprovalInN8n,
  notifyApprovalDecisionInN8n,
} from "@/lib/melano.functions";
import { updateApprovalEconomics } from "@/lib/approval-economics.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — MELANO INC" },
      {
        name: "description",
        content: "Centro de aprobación humana con control de impacto económico y riesgo.",
      },
      { property: "og:title", content: "Approvals — MELANO INC" },
      {
        property: "og:description",
        content: "Decisiones críticas priorizadas por impacto económico, riesgo y evidencia.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

type BusinessCase = {
  version?: number;
  currency?: string;
  revenue_upside_30d?: number;
  cost_avoidance_30d?: number;
  risk_avoidance_30d?: number;
  implementation_cost?: number;
  confidence?: number;
  gross_benefit_30d?: number;
  expected_value_30d?: number;
  payback_days?: number | null;
  gate?: string;
  evidence_note?: string;
  updated_at?: string;
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
  trace_id?: string | null;
  payload?: Record<string, unknown> | null;
};

function businessCaseOf(a: Approval): BusinessCase | null {
  const raw = a.payload?.["business_case"];
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as BusinessCase)
    : null;
}

function money(value: number | null | undefined, currency = "USD") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function ApprovalsPage() {
  const { data: org } = useOrg();
  const { data: approvals, isLoading } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
  });
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const notifyPending = useServerFn(notifyApprovalInN8n);
  const notifyDecided = useServerFn(notifyApprovalDecisionInN8n);
  const saveEconomics = useServerFn(updateApprovalEconomics);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const ordered = useMemo(() => {
    return [...(approvals ?? [])].sort((a, b) => {
      const ap = a.status.toUpperCase() === "PENDING" ? 1 : 0;
      const bp = b.status.toUpperCase() === "PENDING" ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (businessCaseOf(b)?.expected_value_30d ?? -Infinity) -
        (businessCaseOf(a)?.expected_value_30d ?? -Infinity);
    });
  }, [approvals]);

  const summary = useMemo(() => {
    const pending = (approvals ?? []).filter((a) => a.status.toUpperCase() === "PENDING");
    const quantified = pending.filter((a) => businessCaseOf(a));
    const positive = quantified.filter((a) => (businessCaseOf(a)?.expected_value_30d ?? 0) > 0);
    const totalEv = positive.reduce(
      (sum, a) => sum + (businessCaseOf(a)?.expected_value_30d ?? 0),
      0,
    );
    return { pending: pending.length, quantified: quantified.length, positive: positive.length, totalEv };
  }, [approvals]);

  async function act(approval: Approval, approve: boolean) {
    if (!org?.id) return;
    const businessCase = businessCaseOf(approval);
    const note = (notes[approval.id] ?? "").trim();

    if (approve && !businessCase) {
      toast.error("Primero cuantificá el caso económico. No se aprueba a ciegas.");
      return;
    }
    if (approve && (businessCase?.expected_value_30d ?? 0) <= 0 && note.length < 12) {
      toast.error("El EV no es positivo. Justificá la excepción antes de aprobar.");
      return;
    }

    setBusy(approval.id);
    try {
      const decided = await decide({
        data: { approvalId: approval.id, approve, note: note || undefined },
      });
      toast.success(approve ? "Aprobado con caso económico" : "Rechazado");
      const exec = decided.execution;
      if (approve && exec) {
        if (exec.executed) {
          toast.success(`Ejecutada en n8n · cerrada en DONE (${exec.workflow ?? "workflow"})`);
        } else if (exec.error) {
          toast.warning(`No se pudo ejecutar automáticamente: ${exec.error}`);
        }
      }
      const res = await notifyDecided({ data: { organizationId: org.id, approvalId: approval.id } });
      if (res.ok) toast.success("Pipeline actualizado en n8n");
      else if (res.error) toast.warning(`n8n: ${res.error}`);

      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al decidir");
    } finally {
      setBusy(null);
    }
  }

  async function avisar(approvalId: string) {
    if (!org?.id) return;
    setBusy(approvalId);
    try {
      const res = await notifyPending({ data: { organizationId: org.id, approvalId } });
      toast.success(`Aviso enviado a Bruno · ${res.rule}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo avisar por n8n");
    } finally {
      setBusy(null);
    }
  }

  async function saveBusinessCase(
    approvalId: string,
    values: {
      currency: string;
      revenueUpside30d: number;
      costAvoidance30d: number;
      riskAvoidance30d: number;
      implementationCost: number;
      confidence: number;
      evidenceNote: string;
    },
  ) {
    if (!org?.id) return;
    setBusy(approvalId);
    try {
      const result = await saveEconomics({
        data: { organizationId: org.id, approvalId, ...values },
      });
      const bc = result.businessCase;
      toast.success(
        `Caso económico guardado · EV 30d ${money(bc.expected_value_30d, bc.currency)}`,
      );
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el caso económico");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Approvals · Profit Gate"
        subtitle="Cada firma debe mostrar valor económico, costo, riesgo, evidencia y outcome. No aprobar a ciegas."
      />

      {!isLoading ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pendientes" value={String(summary.pending)} />
          <Metric label="Cuantificadas" value={`${summary.quantified}/${summary.pending}`} />
          <Metric label="EV positivo" value={String(summary.positive)} />
          <Metric label="EV priorizado 30d" value={money(summary.totalEv)} />
        </div>
      ) : null}

      {isLoading ? (
        <Empty text="Cargando…" />
      ) : ordered.length === 0 ? (
        <Empty text="Nada esperando autorización." />
      ) : (
        <div className="grid gap-4">
          {ordered.map((a) => {
            const bc = businessCaseOf(a);
            const pending = a.status.toUpperCase() === "PENDING";
            const positive = (bc?.expected_value_30d ?? 0) > 0;
            return (
              <Panel
                key={a.id}
                title={a.category ?? "critical"}
                action={<StatusBadge status={a.status} />}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{a.action}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{a.reason ?? "—"}</p>
                  </div>
                  <div className="rounded-md border px-3 py-2 text-xs">
                    <div className="label-caps">Gate económico</div>
                    <div className="mt-1 font-semibold text-foreground">
                      {!bc ? "SIN CUANTIFICAR" : positive ? "EV POSITIVO" : "EXCEPCIÓN REQUERIDA"}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="EV 30d" value={money(bc?.expected_value_30d, bc?.currency)} />
                  <Stat label="Revenue 30d" value={money(bc?.revenue_upside_30d, bc?.currency)} />
                  <Stat label="Ahorro 30d" value={money(bc?.cost_avoidance_30d, bc?.currency)} />
                  <Stat label="Riesgo evitado" value={money(bc?.risk_avoidance_30d, bc?.currency)} />
                  <Stat label="Costo" value={money(bc?.implementation_cost, bc?.currency)} />
                  <Stat
                    label="Payback"
                    value={
                      bc?.payback_days == null
                        ? "—"
                        : bc.payback_days === 0
                          ? "Inmediato"
                          : `${bc.payback_days} días`
                    }
                  />
                </dl>

                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <Stat label="Impacto" value={a.impact ?? "—"} />
                  <Stat label="Riesgo" value={a.risk ?? "—"} />
                  <Stat label="Solicitado" value={fmtDate(a.requested_at)} />
                </dl>

                {bc?.evidence_note ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Evidencia económica: </span>
                    {bc.evidence_note}
                  </div>
                ) : null}

                {pending ? (
                  <>
                    <BusinessCaseEditor
                      approval={a}
                      businessCase={bc}
                      disabled={busy === a.id}
                      onSave={(values) => saveBusinessCase(a.id, values)}
                    />

                    <div className="mt-4">
                      <Label htmlFor={`note-${a.id}`}>Nota de decisión / excepción</Label>
                      <Textarea
                        id={`note-${a.id}`}
                        className="mt-1"
                        value={notes[a.id] ?? ""}
                        onChange={(e) =>
                          setNotes((current) => ({ ...current, [a.id]: e.target.value }))
                        }
                        placeholder={
                          bc && !positive
                            ? "Obligatoria para aprobar un EV no positivo. Explicá por qué protege revenue, cliente, seguridad o continuidad."
                            : "Opcional para dejar trazabilidad de la decisión."
                        }
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy === a.id || !bc}
                        onClick={() => act(a, true)}
                      >
                        {bc && !positive ? "Aprobar excepción" : "Aprobar + ejecutar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === a.id}
                        onClick={() => act(a, false)}
                      >
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === a.id}
                        onClick={() => avisar(a.id)}
                      >
                        Avisar a Bruno (n8n)
                      </Button>
                    </div>
                  </>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="label-caps">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}

function BusinessCaseEditor({
  approval,
  businessCase,
  disabled,
  onSave,
}: {
  approval: Approval;
  businessCase: BusinessCase | null;
  disabled: boolean;
  onSave: (values: {
    currency: string;
    revenueUpside30d: number;
    costAvoidance30d: number;
    riskAvoidance30d: number;
    implementationCost: number;
    confidence: number;
    evidenceNote: string;
  }) => void;
}) {
  const [currency, setCurrency] = useState(businessCase?.currency ?? "USD");
  const [revenue, setRevenue] = useState(String(businessCase?.revenue_upside_30d ?? ""));
  const [savings, setSavings] = useState(String(businessCase?.cost_avoidance_30d ?? ""));
  const [riskAvoidance, setRiskAvoidance] = useState(
    String(businessCase?.risk_avoidance_30d ?? ""),
  );
  const [cost, setCost] = useState(String(businessCase?.implementation_cost ?? ""));
  const [confidence, setConfidence] = useState(
    String(Math.round((businessCase?.confidence ?? 0.7) * 100)),
  );
  const [evidence, setEvidence] = useState(businessCase?.evidence_note ?? "");

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">Caso económico verificable</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Horizonte 30 días. Usá 0 cuando el componente no aplique. No cargues ROI inventado.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Moneda">
          <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Revenue +">
          <Input inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Ahorro +">
          <Input inputMode="decimal" value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Riesgo evitado +">
          <Input inputMode="decimal" value={riskAvoidance} onChange={(e) => setRiskAvoidance(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Costo implementación -">
          <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Confianza %">
          <Input inputMode="numeric" value={confidence} onChange={(e) => setConfidence(e.target.value)} placeholder="70" />
        </Field>
      </div>
      <div className="mt-3">
        <Label htmlFor={`evidence-${approval.id}`}>Fuente / evidencia del cálculo</Label>
        <Textarea
          id={`evidence-${approval.id}`}
          className="mt-1"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Ej.: oportunidad CRM, ahorro mensual del proveedor, presupuesto aprobado, costo de incidente evitado."
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onSave({
              currency: currency || "USD",
              revenueUpside30d: Number(revenue || 0),
              costAvoidance30d: Number(savings || 0),
              riskAvoidance30d: Number(riskAvoidance || 0),
              implementationCost: Number(cost || 0),
              confidence: Number(confidence || 0) / 100,
              evidenceNote: evidence,
            })
          }
        >
          Calcular y guardar EV
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
