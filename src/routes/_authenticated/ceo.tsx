import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { N8nWorkflowsPanel } from "@/components/melano/n8n-panel";
import { MomentumPanel } from "@/components/melano/momentum";

import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ceo")({
  head: () => ({
    meta: [
      { title: "CEO Dashboard — MELANO INC" },
      {
        name: "description",
        content:
          "Panel ejecutivo del CEO con KPIs verificados de clientes, leads, aprobaciones y decisiones.",
      },
      { property: "og:title", content: "CEO Dashboard — MELANO INC" },
      {
        property: "og:description",
        content: "KPIs ejecutivos de clientes, leads, aprobaciones y decisiones en tiempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CeoGuarded,
});

type Client = {
  id: string;
  name: string;
  status: string;
  luxia_stage: "FASE_0_14" | "FASE_15_45" | "FASE_46_90";
  mrr: number | null;
  currency: string;
  next_action: string | null;
  next_follow_up_at: string | null;
};

type Lead = {
  id: string;
  full_name: string;
  phase: "FASE_0_14" | "FASE_15_45" | "FASE_46_90";
  status: string;
  next_follow_up_at: string | null;
};

type Approval = {
  id: string;
  action: string;
  status: string;
  risk: string | null;
  requested_at: string;
};

type Decision = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

const STAGE_LABEL: Record<string, string> = {
  FASE_0_14: "Fase 0–14",
  FASE_15_45: "Fase 15–45",
  FASE_46_90: "Fase 46–90",
};

const isOverdue = (value?: string | null) => !!value && new Date(value) < new Date();

function CeoGuarded() {
  return (
    <RoleGate allow={["CEO"]}>
      <CeoDashboard />
    </RoleGate>
  );
}

function CeoDashboard() {
  const { data: org } = useOrg();
  useRealtime(["clients", "leads", "approvals", "decisions"]);

  const { data: clients, isLoading } = useOrgRows<Client>("clients", org?.id, {
    order: "created_at",
    limit: 500,
  });
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "created_at", limit: 1000 });
  const { data: approvals } = useOrgRows<Approval>("approvals", org?.id, {
    order: "requested_at",
    limit: 300,
  });
  const { data: decisions } = useOrgRows<Decision>("decisions", org?.id, {
    order: "created_at",
    limit: 300,
  });

  const allClients = clients ?? [];
  const allLeads = leads ?? [];
  const allApprovals = approvals ?? [];
  const allDecisions = decisions ?? [];

  const activeClients = allClients.filter((c) => c.status !== "BAJA" && c.status !== "PERDIDO");
  const mrr = activeClients.reduce((acc, c) => acc + Number(c.mrr ?? 0), 0);
  const wonLeads = allLeads.filter((l) => l.status === "GANADO").length;
  const openLeads = allLeads.filter(
    (l) => !["GANADO", "PERDIDO", "DESCARTADO"].includes(l.status),
  );
  const conversion = allLeads.length ? Math.round((wonLeads / allLeads.length) * 100) : null;
  const pendingApprovals = allApprovals.filter((a) => a.status === "PENDING");
  const openDecisions = allDecisions.filter((d) =>
    ["PROPOSED", "EXECUTING"].includes(d.status),
  );
  const overdueFollowUps = [
    ...allLeads.filter((l) => isOverdue(l.next_follow_up_at)),
    ...allClients.filter((c) => isOverdue(c.next_follow_up_at)),
  ].length;

  const stageCounts = (["FASE_0_14", "FASE_15_45", "FASE_46_90"] as const).map((stage) => ({
    stage,
    clients: allClients.filter((c) => c.luxia_stage === stage).length,
    leads: allLeads.filter((l) => l.phase === stage).length,
  }));

  return (
    <>
      <PageHeader
        title="CEO Dashboard"
        subtitle="Vista ejecutiva exclusiva del CEO: clientes, leads, aprobaciones y decisiones con datos persistidos."
      />

      {isLoading ? (
        <Empty text="Cargando indicadores…" />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Clientes activos"
              value={activeClients.length}
              hint={`${allClients.length} registrados en total`}
            />
            <Kpi
              label="MRR contratado"
              value={mrr > 0 ? `USD ${mrr.toLocaleString("es-AR")}` : "SIN DATOS"}
              tone={mrr > 0 ? "good" : "muted"}
            />
            <Kpi
              label="Leads abiertos"
              value={openLeads.length}
              hint={`${allLeads.length} en la cohorte`}
            />
            <Kpi
              label="Conversión de leads"
              value={conversion === null ? "SIN DATOS" : `${conversion}%`}
              hint={conversion === null ? undefined : `${wonLeads} ganados`}
            />
            <Kpi
              label="Aprobaciones pendientes"
              value={pendingApprovals.length}
              tone={pendingApprovals.length > 0 ? "warn" : "good"}
            />
            <Kpi
              label="Decisiones abiertas"
              value={openDecisions.length}
              hint={`${allDecisions.length} registradas`}
            />
            <Kpi
              label="Seguimientos vencidos"
              value={overdueFollowUps}
              tone={overdueFollowUps > 0 ? "bad" : "good"}
            />
            <Kpi
              label="Decisiones completadas"
              value={allDecisions.filter((d) => d.status === "COMPLETED").length}
            />
          </section>

          <Panel title="Embudo LUXIA · clientes y leads por etapa">
            <div className="grid gap-3 sm:grid-cols-3">
              {stageCounts.map((s) => (
                <div key={s.stage} className="rounded-md border border-border p-3">
                  <p className="label-caps">{STAGE_LABEL[s.stage]}</p>
                  <p className="mt-2 text-sm text-foreground">
                    {s.clients} cliente{s.clients === 1 ? "" : "s"} · {s.leads} lead
                    {s.leads === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Aprobaciones pendientes">
              {pendingApprovals.length === 0 ? (
                <Empty text="Sin aprobaciones pendientes." />
              ) : (
                <ul className="space-y-2">
                  {pendingApprovals.slice(0, 8).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{a.action}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {fmtDate(a.requested_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Decisiones recientes">
              {allDecisions.length === 0 ? (
                <Empty text="Sin decisiones registradas." />
              ) : (
                <ul className="space-y-2">
                  {allDecisions.slice(0, 8).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{d.title}</span>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <N8nWorkflowsPanel />

          <Panel title="Clientes · próxima acción">
            {allClients.length === 0 ? (
              <Empty text="Sin clientes cargados." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-caps py-2 pr-3 font-medium">Cliente</th>
                      <th className="label-caps py-2 pr-3 font-medium">Etapa LUXIA</th>
                      <th className="label-caps py-2 pr-3 font-medium">Estado</th>
                      <th className="label-caps py-2 pr-3 font-medium">Próximo contacto</th>
                      <th className="label-caps py-2 pr-3 font-medium">Próxima acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClients.slice(0, 12).map((c) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 text-foreground">{c.name}</td>
                        <td className="py-2 pr-3 text-foreground">
                          {STAGE_LABEL[c.luxia_stage] ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td
                          className={cn(
                            "py-2 pr-3",
                            isOverdue(c.next_follow_up_at)
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.next_follow_up_at ? fmtDate(c.next_follow_up_at) : "Sin programar"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.next_action ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  tone?: "muted" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    muted: "text-foreground",
    good: "text-success",
    warn: "text-warning",
    bad: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="label-caps">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
