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
import { decideApproval } from "@/lib/runtime.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — MELANO INC" },
      { name: "description", content: "Centro de aprobación humana para acciones críticas del sistema." },
      { property: "og:title", content: "Approvals — MELANO INC" },
      { property: "og:description", content: "Autoridad final humana sobre acciones críticas." },
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
  const notifyPending = useServerFn(notifyApprovalInN8n);
  const notifyDecided = useServerFn(notifyApprovalDecisionInN8n);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(approvalId: string, approve: boolean) {
    if (!org?.id) return;
    setBusy(approvalId);
    try {
      const decided = await decide({ data: { approvalId, approve } });
      toast.success(approve ? "Aprobado" : "Rechazado");
      const exec = decided.execution;
      if (approve && exec) {
        if (exec.executed) toast.success(`Ejecutada en n8n · cerrada en DONE (${exec.workflow ?? "workflow"})`);
        else if (exec.error) toast.warning(`No se pudo ejecutar automáticamente: ${exec.error}`);
      }
      const res = await notifyDecided({ data: { organizationId: org.id, approvalId } });
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

  return (
    <>
      <PageHeader title="Approvals" subtitle="Bruno es la autoridad final. Nada crítico se ejecuta sin firma." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (approvals ?? []).length === 0 ? (
        <Empty text="Nada esperando autorización." />
      ) : (
        <div className="grid gap-4">
          {(approvals ?? []).map((a) => (
            <Panel key={a.id} title={a.category ?? "critical"} action={<StatusBadge status={a.status} />}>
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
              {a.status.toLowerCase() === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" disabled={busy === a.id} onClick={() => act(a.id, true)}>
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === a.id}
                    onClick={() => act(a.id, false)}
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
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
