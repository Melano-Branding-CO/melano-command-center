import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { N8nWorkflowsPanel } from "@/components/melano/n8n-panel";
import { fmtDate, useMyRole, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { supabase } from "@/integrations/supabase/client";
import { listOrgMembers } from "@/lib/melano.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operador-dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard del operador — MELANO INC" },
      {
        name: "description",
        content:
          "Dashboard por operador: cartera asignada, fases LUXIA, próximos contactos y avance de tareas.",
      },
      { property: "og:title", content: "Dashboard del operador — MELANO INC" },
      {
        property: "og:description",
        content: "Cartera, fases LUXIA, próximos contactos y avance de tareas por operador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate allow={["OPERATOR", "ADMIN", "CEO"]}>
      <OperatorDashboard />
    </RoleGate>
  ),
});

type Stage = "FASE_0_14" | "FASE_15_45" | "FASE_46_90";

type Client = {
  id: string;
  name: string;
  status: string;
  luxia_stage: Stage;
  mrr: number | null;
  owner_user: string | null;
  next_action: string | null;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
};

type Lead = {
  id: string;
  full_name: string;
  phase: Stage;
  status: string;
  owner_user: string | null;
  next_follow_up_at: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_user: string | null;
  deadline: string | null;
  success_metric: string | null;
};

const STAGE_LABEL: Record<Stage, string> = {
  FASE_0_14: "Fase 0–14",
  FASE_15_45: "Fase 15–45",
  FASE_46_90: "Fase 46–90",
};

const STAGES: Stage[] = ["FASE_0_14", "FASE_15_45", "FASE_46_90"];
const isOverdue = (v?: string | null) => !!v && new Date(v) < new Date();

function OperatorDashboard() {
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";
  useRealtime(["clients", "leads", "tasks"]);

  const [me, setMe] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user?.id ?? null);
      setSelected((prev) => prev ?? data.user?.id ?? null);
    });
  }, []);

  const membersFn = useServerFn(listOrgMembers);
  const membersQuery = useQuery({
    queryKey: ["org-members", org?.id],
    enabled: !!org?.id && isAdmin,
    queryFn: async () => (await membersFn({ data: { organizationId: org!.id } })).members,
  });
  const members = membersQuery.data ?? [];
  const operatorLabel = (id: string | null) => {
    if (!id) return "Sin asignar";
    if (id === me) return "Mi cartera";
    const m = members.find((x) => x.userId === id);
    return m?.fullName || m?.email || id.slice(0, 8);
  };

  const { data: clients, isLoading } = useOrgRows<Client>("clients", org?.id, {
    order: "created_at",
    limit: 500,
  });
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "created_at", limit: 1000 });
  const { data: tasks } = useOrgRows<Task>("tasks", org?.id, { order: "created_at", limit: 500 });

  const target = selected ?? me;

  const myClients = useMemo(
    () => (clients ?? []).filter((c) => c.owner_user === target),
    [clients, target],
  );
  const myLeads = useMemo(
    () => (leads ?? []).filter((l) => l.owner_user === target),
    [leads, target],
  );
  const myTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.assigned_user === target),
    [tasks, target],
  );

  const mrr = myClients
    .filter((c) => c.status !== "BAJA" && c.status !== "PERDIDO")
    .reduce((acc, c) => acc + Number(c.mrr ?? 0), 0);
  const overdue = [...myClients, ...myLeads].filter((r) => isOverdue(r.next_follow_up_at)).length;
  const openTasks = myTasks.filter((t) => !["DONE", "FAILED"].includes(t.status));
  const doneTasks = myTasks.filter((t) => t.status === "DONE").length;
  const completion = myTasks.length ? Math.round((doneTasks / myTasks.length) * 100) : null;

  const upcoming = [
    ...myClients.map((c) => ({
      id: `c-${c.id}`,
      name: c.name,
      kind: "Cliente",
      stage: STAGE_LABEL[c.luxia_stage],
      when: c.next_follow_up_at,
      action: c.next_action,
    })),
    ...myLeads.map((l) => ({
      id: `l-${l.id}`,
      name: l.full_name,
      kind: "Lead",
      stage: STAGE_LABEL[l.phase],
      when: l.next_follow_up_at,
      action: null as string | null,
    })),
  ]
    .filter((r) => r.when)
    .sort((a, b) => new Date(a.when!).getTime() - new Date(b.when!).getTime())
    .slice(0, 12);

  return (
    <>
      <PageHeader
        title="Dashboard del operador"
        subtitle="Cartera asignada, fases LUXIA, próximos contactos y avance de tareas con datos persistidos."
      />

      {isAdmin ? (
        <Panel title="Operador">
          <div className="max-w-sm">
            <Select value={target ?? ""} onValueChange={(v) => setSelected(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un operador" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {(m.fullName || m.email || m.userId.slice(0, 8)) + ` · ${m.role}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Viendo: {operatorLabel(target)}
            </p>
          </div>
        </Panel>
      ) : null}

      {isLoading ? (
        <Empty text="Cargando cartera…" />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Clientes en cartera" value={myClients.length} />
            <Kpi label="Leads asignados" value={myLeads.length} />
            <Kpi
              label="MRR de la cartera"
              value={mrr > 0 ? `USD ${mrr.toLocaleString("es-AR")}` : "SIN DATOS"}
              tone={mrr > 0 ? "good" : "muted"}
            />
            <Kpi
              label="Seguimientos vencidos"
              value={overdue}
              tone={overdue > 0 ? "bad" : "good"}
            />
            <Kpi label="Tareas abiertas" value={openTasks.length} />
            <Kpi label="Tareas completadas" value={doneTasks} />
            <Kpi
              label="Avance de tareas"
              value={completion === null ? "SIN DATOS" : `${completion}%`}
              hint={completion === null ? undefined : `${doneTasks}/${myTasks.length}`}
            />
            <Kpi
              label="Tareas bloqueadas"
              value={myTasks.filter((t) => t.status === "BLOCKED").length}
              tone={myTasks.some((t) => t.status === "BLOCKED") ? "warn" : "good"}
            />
          </section>

          <Panel title="Cartera por fase LUXIA">
            <div className="grid gap-3 sm:grid-cols-3">
              {STAGES.map((s) => (
                <div key={s} className="rounded-md border border-border p-3">
                  <p className="label-caps">{STAGE_LABEL[s]}</p>
                  <p className="mt-2 text-sm text-foreground">
                    {myClients.filter((c) => c.luxia_stage === s).length} cliente(s) ·{" "}
                    {myLeads.filter((l) => l.phase === s).length} lead(s)
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Próximos contactos">
            {upcoming.length === 0 ? (
              <Empty text="Sin próximos contactos programados." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-caps py-2 pr-3 font-medium">Registro</th>
                      <th className="label-caps py-2 pr-3 font-medium">Tipo</th>
                      <th className="label-caps py-2 pr-3 font-medium">Fase</th>
                      <th className="label-caps py-2 pr-3 font-medium">Fecha</th>
                      <th className="label-caps py-2 pr-3 font-medium">Próxima acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 text-foreground">{r.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.kind}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.stage}</td>
                        <td
                          className={cn(
                            "py-2 pr-3",
                            isOverdue(r.when) ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {fmtDate(r.when)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.action ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <N8nWorkflowsPanel />

          <Panel title="Avance de tareas asignadas">
            {myTasks.length === 0 ? (
              <Empty text="Sin tareas asignadas a este operador." />
            ) : (
              <ul className="divide-y divide-border">
                {myTasks.slice(0, 15).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <div className="min-w-[12rem] flex-1">
                      <p className="truncate text-foreground">{t.title}</p>
                      {t.success_metric ? (
                        <p className="truncate text-xs text-muted-foreground">
                          Objetivo: {t.success_metric}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        isOverdue(t.deadline) && t.status !== "DONE"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {t.deadline ? fmtDate(t.deadline) : "Sin vencimiento"}
                    </span>
                  </li>
                ))}
              </ul>
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
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
