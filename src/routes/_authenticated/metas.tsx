import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { fmtDate, useMyRole, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { supabase } from "@/integrations/supabase/client";
import { getPublicStats } from "@/lib/public-stats.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas anuales — KPIs vs objetivos | MELANO INC" },
      {
        name: "description",
        content:
          "Panel de metas anuales: leads, aprobaciones, contratos y MRR comparados con los KPIs públicos verificados.",
      },
      { property: "og:title", content: "Metas anuales — KPIs vs objetivos" },
      {
        property: "og:description",
        content: "Objetivos anuales de leads, aprobaciones, contratos y MRR contra datos reales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate allow={["CEO", "ADMIN"]}>
      <GoalsPage />
    </RoleGate>
  ),
});

type Goal = {
  id: string;
  year: number;
  leads_target: number;
  approvals_target: number;
  contracts_target: number;
  mrr_target: number;
  notes: string | null;
  updated_at: string;
};

type Lead = { id: string; status: string; created_at: string };
type Approval = { id: string; status: string; requested_at: string };
type Client = { id: string; status: string; mrr: number | null; created_at: string };

const YEAR = new Date().getFullYear();
const inYear = (value: string | null | undefined, year: number) =>
  !!value && new Date(value).getFullYear() === year;

function GoalsPage() {
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";
  const qc = useQueryClient();
  useRealtime(["annual_goals", "leads", "approvals", "clients"]);

  const [year, setYear] = useState(YEAR);
  const { data: goals } = useOrgRows<Goal>("annual_goals", org?.id, { order: "year" });
  const goal = useMemo(() => (goals ?? []).find((g) => g.year === year) ?? null, [goals, year]);

  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "created_at", limit: 2000 });
  const { data: approvals } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
    limit: 2000,
  });
  const { data: clients } = useOrgRows<Client>("clients", org?.id, {
    order: "created_at",
    limit: 1000,
  });

  const statsFn = useServerFn(getPublicStats);
  const publicStats = useQuery({ queryKey: ["public-stats"], queryFn: () => statsFn({}) });

  const yearLeads = (leads ?? []).filter((l) => inYear(l.created_at, year)).length;
  const yearApprovals = (approvals ?? []).filter(
    (a) => inYear(a.requested_at, year) && a.status === "APPROVED",
  ).length;
  const yearContracts = (clients ?? []).filter(
    (c) => inYear(c.created_at, year) && c.status !== "PROSPECTO",
  ).length;
  const currentMrr = (clients ?? [])
    .filter((c) => c.status !== "BAJA" && c.status !== "PERDIDO")
    .reduce((acc, c) => acc + Number(c.mrr ?? 0), 0);

  const [form, setForm] = useState({
    leads: "",
    approvals: "",
    contracts: "",
    mrr: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      leads: goal ? String(goal.leads_target) : "",
      approvals: goal ? String(goal.approvals_target) : "",
      contracts: goal ? String(goal.contracts_target) : "",
      mrr: goal ? String(goal.mrr_target) : "",
      notes: goal?.notes ?? "",
    });
  }, [goal?.id, year]);

  async function saveGoal() {
    if (!org?.id) return;
    setBusy(true);
    try {
      const payload = {
        organization_id: org.id,
        year,
        leads_target: Number(form.leads || 0),
        approvals_target: Number(form.approvals || 0),
        contracts_target: Number(form.contracts || 0),
        mrr_target: Number(form.mrr || 0),
        notes: form.notes.trim() || null,
      };
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("annual_goals")
        .upsert(payload, { onConflict: "organization_id,year" });
      if (error) throw new Error(error.message);
      toast.success(`Metas ${year} guardadas`);
      qc.invalidateQueries({ queryKey: ["annual_goals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar las metas");
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    { label: "Leads generados", real: yearLeads, target: goal?.leads_target ?? 0 },
    { label: "Aprobaciones otorgadas", real: yearApprovals, target: goal?.approvals_target ?? 0 },
    { label: "Contratos / clientes", real: yearContracts, target: goal?.contracts_target ?? 0 },
    { label: "MRR (USD)", real: currentMrr, target: Number(goal?.mrr_target ?? 0), money: true },
  ];

  const pt = publicStats.data?.totals;

  return (
    <>
      <PageHeader
        title="Metas anuales"
        subtitle="Objetivos de leads, aprobaciones, contratos y MRR contrastados con los datos reales del sistema."
      />

      <Panel title={`Progreso ${year}`}>
        <div className="mb-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            ◀ {year - 1}
          </Button>
          <span className="text-sm font-semibold text-foreground">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            {year + 1} ▶
          </Button>
          {goal ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Actualizado {fmtDate(goal.updated_at)}
            </span>
          ) : null}
        </div>

        {!goal ? (
          <Empty text={`No hay metas definidas para ${year}.`} />
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const pct = r.target > 0 ? Math.min(100, Math.round((r.real / r.target) * 100)) : null;
              const fmt = (n: number) =>
                r.money ? `USD ${n.toLocaleString("es-AR")}` : n.toLocaleString("es-AR");
              return (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{r.label}</span>
                    <span className="text-muted-foreground">
                      {fmt(r.real)} / {r.target > 0 ? fmt(r.target) : "sin meta"}
                      {pct === null ? "" : ` · ${pct}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct === null
                          ? "bg-muted-foreground/40"
                          : pct >= 100
                            ? "bg-success"
                            : pct >= 50
                              ? "bg-primary"
                              : "bg-warning",
                      )}
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Comparación con los KPIs públicos">
        {publicStats.isLoading ? (
          <Empty text="Cargando KPIs públicos…" />
        ) : !pt ? (
          <Empty text="KPIs públicos no disponibles." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps py-2 pr-3 font-medium">Indicador</th>
                  <th className="label-caps py-2 pr-3 font-medium">Público (histórico)</th>
                  <th className="label-caps py-2 pr-3 font-medium">{year} interno</th>
                  <th className="label-caps py-2 pr-3 font-medium">Meta {year}</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Leads"
                  publicValue={pt.leads}
                  internal={yearLeads}
                  target={goal?.leads_target}
                />
                <CompareRow
                  label="Aprobaciones"
                  publicValue={pt.approvals}
                  internal={yearApprovals}
                  target={goal?.approvals_target}
                />
                <CompareRow
                  label="Clientes / contratos"
                  publicValue={pt.clients}
                  internal={yearContracts}
                  target={goal?.contracts_target}
                />
                <CompareRow
                  label="MRR (USD)"
                  publicValue={null}
                  internal={currentMrr}
                  target={goal ? Number(goal.mrr_target) : undefined}
                />
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              El MRR no se publica en la pantalla pública: solo se compara internamente.
            </p>
          </div>
        )}
      </Panel>

      {isAdmin ? (
        <Panel title={goal ? `Editar metas ${year}` : `Definir metas ${year}`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label>Meta de leads</Label>
              <Input
                type="number"
                min={0}
                value={form.leads}
                onChange={(e) => setForm((f) => ({ ...f, leads: e.target.value }))}
              />
            </div>
            <div>
              <Label>Meta de aprobaciones</Label>
              <Input
                type="number"
                min={0}
                value={form.approvals}
                onChange={(e) => setForm((f) => ({ ...f, approvals: e.target.value }))}
              />
            </div>
            <div>
              <Label>Meta de contratos</Label>
              <Input
                type="number"
                min={0}
                value={form.contracts}
                onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              />
            </div>
            <div>
              <Label>Meta de MRR (USD)</Label>
              <Input
                type="number"
                min={0}
                value={form.mrr}
                onChange={(e) => setForm((f) => ({ ...f, mrr: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 xl:col-span-4">
              <Label>Notas / supuestos</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Supuestos del plan anual, restricciones y criterios de revisión."
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={saveGoal} disabled={busy}>
              {busy ? "Guardando…" : goal ? "Guardar cambios" : `Crear metas ${year}`}
            </Button>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function CompareRow({
  label,
  publicValue,
  internal,
  target,
}: {
  label: string;
  publicValue: number | null;
  internal: number;
  target?: number | undefined;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-2 pr-3 text-foreground">{label}</td>
      <td className="py-2 pr-3 text-muted-foreground">
        {publicValue === null ? "No publicado" : publicValue.toLocaleString("es-AR")}
      </td>
      <td className="py-2 pr-3 text-foreground">{internal.toLocaleString("es-AR")}</td>
      <td className="py-2 pr-3 text-muted-foreground">
        {target && target > 0 ? target.toLocaleString("es-AR") : "sin meta"}
      </td>
    </tr>
  );
}
