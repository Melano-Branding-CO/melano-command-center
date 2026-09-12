import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge, PriorityBadge } from "@/components/melano/badges";
import { fmtDate, useOrg, useAgents } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/green-gate")({
  head: () => ({
    meta: [
      { title: "Green Gate · LUXIA — MELANO INC" },
      {
        name: "description",
        content:
          "Estado de LUXIA, flujo de leads y plan 0–14 / 15–45 / 46–90 con actualización de estado en tiempo real.",
      },
      { property: "og:title", content: "Green Gate · LUXIA — MELANO INC" },
      {
        property: "og:description",
        content: "Control del Green Gate de LUXIA: leads, plan por fases y estados verificados.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GreenGatePage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  next_action: string | null;
  deadline: string | null;
  result: string | null;
  updated_at: string | null;
};

type Metric = {
  id: string;
  key: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  captured_at: string | null;
};

type AgentRun = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  output: unknown;
  trace_id: string | null;
};

const PHASES = [
  {
    key: "0-14",
    label: "Fase 0–14 días",
    desc: "Activación inmediata: limpieza de leads, primer contacto, tablero mínimo.",
    match: /0\s*[–-]\s*14|fase\s*1|activaci|inmediat/i,
  },
  {
    key: "15-45",
    label: "Fase 15–45 días",
    desc: "Conversión: pipeline comercial, seguimiento sistemático, primeras ventas.",
    match: /15\s*[–-]\s*45|fase\s*2|conversi|pipeline/i,
  },
  {
    key: "46-90",
    label: "Fase 46–90 días",
    desc: "Escala: automatización del flujo, revenue recurrente, Green Gate completo.",
    match: /46\s*[–-]\s*90|fase\s*3|escal|green\s*gate/i,
  },
] as const;

const NEXT_STATUS: Record<string, string> = {
  BACKLOG: "READY",
  READY: "RUNNING",
  RUNNING: "REVIEW",
  REVIEW: "DONE",
  BLOCKED: "READY",
  FAILED: "READY",
};

const LEAD_MATCH = /lead|prospect|contacto/i;

type Lead = {
  id: string;
  full_name: string;
  phase: string;
  status: string;
  next_follow_up_at: string | null;
};

const LEAD_PHASES = [
  {
    key: "FASE_0_14",
    stage: "reunion",
    label: "Fase 0–14 · Contacto y reunión",
    desc: "Primer contacto, calificación y reunión agendada.",
  },
  {
    key: "FASE_15_45",
    stage: "propuesta",
    label: "Fase 15–45 · Propuesta",
    desc: "Propuesta enviada, negociación y aprobación comercial.",
  },
  {
    key: "FASE_46_90",
    stage: "contrato",
    label: "Fase 46–90 · Contrato",
    desc: "Contrato firmado, onboarding y revenue recurrente.",
  },
] as const;

const LEAD_STATUSES = [
  "NUEVO",
  "CONTACTADO",
  "CALIFICADO",
  "NEGOCIACION",
  "GANADO",
  "PERDIDO",
  "DESCARTADO",
] as const;


function GreenGatePage() {
  const { data: org } = useOrg();
  useRealtime(["tasks", "metrics", "agent_runs", "agents", "leads"]);
  const { data: agents } = useAgents(org?.id);
  const luxia = (agents ?? []).find((a) => a.code === "LUXIA");

  const { data: tasks, isLoading } = useOrgRows<Task>("tasks", org?.id, {
    order: "created_at",
  });
  const { data: metrics } = useOrgRows<Metric>("metrics", org?.id, { order: "captured_at" });
  const { data: runs } = useOrgRows<AgentRun>("agent_runs", org?.id, {
    eq: luxia ? { agent_id: luxia.id } : {},
    order: "started_at",
    limit: 5,
  });
  const { data: leads } = useOrgRows<Lead>("leads", org?.id, { order: "created_at" });


  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const luxiaTasks = useMemo(
    () =>
      (tasks ?? []).filter((t) =>
        /luxia|green\s*gate|lead|inmobili/i.test(`${t.title} ${t.description ?? ""}`),
      ),
    [tasks],
  );

  const phases = useMemo(
    () =>
      PHASES.map((p) => ({
        ...p,
        tasks: luxiaTasks.filter((t) =>
          p.match.test(`${t.title} ${t.description ?? ""}`),
        ),
      })),
    [luxiaTasks],
  );

  const unassigned = luxiaTasks.filter((t) => !phases.some((p) => p.tasks.includes(t)));

  const leadMetrics = (metrics ?? []).filter((m) =>
    LEAD_MATCH.test(`${m.key} ${m.label ?? ""}`),
  );

  const upcoming = useMemo(
    () =>
      (leads ?? [])
        .filter((l) => !!l.next_follow_up_at)
        .sort((a, b) => (a.next_follow_up_at! < b.next_follow_up_at! ? -1 : 1))
        .slice(0, 5),
    [leads],
  );

  const lastRun = (runs ?? [])[0] ?? null;


  async function setStatus(task: Task, status: string) {
    setBusy(task.id);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "RUNNING") patch["started_at"] = new Date().toISOString();
      if (status === "DONE") patch["completed_at"] = new Date().toISOString();
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("tasks")
        .update(patch)
        .eq("id", task.id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        organization_id: org!.id,
        actor_type: "human",
        action: "task.status_changed",
        entity_type: "task",
        entity_id: task.id,
        detail: { from: task.status, to: status, screen: "green-gate" },
        trace_id: lastRun?.trace_id ?? null,
      });
      toast.success(`"${task.title}" → ${status}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Green Gate · LUXIA"
        subtitle="Real Estate Intelligence: estado del agente, flujo de leads y plan por fases."
      />

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Estado de LUXIA"
          action={luxia ? <StatusBadge status={luxia.status} /> : undefined}
        >
          {luxia ? (
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="label-caps">Habilitado</dt>
                <dd className="text-foreground">{luxia.enabled ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt className="label-caps">Confianza</dt>
                <dd className="text-foreground">{luxia.confidence}</dd>
              </div>
              <div>
                <dt className="label-caps">Última ejecución</dt>
                <dd className="text-foreground">{fmtDate(luxia.last_run_at)}</dd>
              </div>
              <div>
                <dt className="label-caps">Último resultado</dt>
                <dd className="truncate text-foreground">{luxia.last_result ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <Empty text="Agente LUXIA no encontrado." />
          )}
          {lastRun ? (
            <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
              Último run: <StatusBadge status={lastRun.status} /> · {fmtDate(lastRun.started_at)}
              {lastRun.trace_id ? (
                <span className="ml-2 font-mono">trace {lastRun.trace_id.slice(0, 8)}</span>
              ) : null}
            </p>
          ) : null}
        </Panel>

        <Panel title="Flujo de leads">
          {leadMetrics.length === 0 ? (
            <Empty text="Sin métricas de leads verificadas. Estado: PENDIENTE (1.200 leads reportados sin fuente)." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {leadMetrics.map((m) => (
                <div key={m.id} className="rounded-md border border-border p-3">
                  <p className="label-caps">{m.label ?? m.key}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {m.value}
                    <span className="ml-1 text-xs text-muted-foreground">{m.unit ?? ""}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Verificado {fmtDate(m.captured_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Leads por fase LUXIA"
          action={
            <span className="text-[11px] text-muted-foreground">{leads?.length ?? 0} totales</span>
          }
        >
          {(leads?.length ?? 0) === 0 ? (
            <Empty text="Sin leads cargados. Importalos desde Leads · LUXIA." />
          ) : (
            <div className="grid gap-3">
              {LEAD_PHASES.map((p) => {
                const rows = (leads ?? []).filter((l) => l.phase === p.key);
                const pct = Math.round((rows.length / Math.max(leads!.length, 1)) * 100);
                return (
                  <div key={p.key} className="rounded-md border border-border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="label-caps">{p.label}</p>
                      <span className="text-sm font-semibold text-foreground">{rows.length}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{p.desc}</p>
                    <Link
                      to="/luxia/$stage"
                      params={{ stage: p.stage }}
                      className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
                    >
                      Abrir pipeline →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Pipeline comercial">
          {(leads?.length ?? 0) === 0 ? (
            <Empty text="Sin pipeline: no hay leads verificados todavía." />
          ) : (
            <>
              <div className="grid gap-2">
                {LEAD_STATUSES.map((s) => {
                  const rows = (leads ?? []).filter((l) => l.status === s);
                  const pct = Math.round((rows.length / Math.max(leads!.length, 1)) * 100);
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{s}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-foreground">
                        {rows.length}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <p className="label-caps mb-2">Próximos contactos</p>
                {upcoming.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Sin próximos contactos agendados.
                  </p>
                ) : (
                  <ul className="grid gap-1.5">
                    {upcoming.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 text-xs">
                        <span className="truncate text-foreground">{l.full_name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {fmtDate(l.next_follow_up_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Panel>
      </section>


      {isLoading ? (
        <Empty text="Cargando plan…" />
      ) : (
        <div className="grid gap-6">
          {phases.map((phase) => (
            <section key={phase.key}>
              <h2 className="label-caps mb-1">{phase.label}</h2>
              <p className="mb-3 text-xs text-muted-foreground">{phase.desc}</p>
              {phase.tasks.length === 0 ? (
                <Empty text="Sin tareas en esta fase." />
              ) : (
                <div className="grid gap-4">
                  {phase.tasks.map((t) => {
                    const next = NEXT_STATUS[t.status];
                    return (
                      <Panel
                        key={t.id}
                        title={t.priority}
                        action={<StatusBadge status={t.status} />}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                            {t.description ? (
                              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                            ) : null}
                            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                              <div>
                                <dt className="label-caps">Próxima acción</dt>
                                <dd className="text-foreground">{t.next_action ?? "—"}</dd>
                              </div>
                              <div>
                                <dt className="label-caps">Deadline</dt>
                                <dd className="text-foreground">{fmtDate(t.deadline)}</dd>
                              </div>
                              <div>
                                <dt className="label-caps">Prioridad</dt>
                                <dd><PriorityBadge priority={t.priority} /></dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {next ? (
                            <Button
                              size="sm"
                              disabled={busy === t.id}
                              onClick={() => setStatus(t, next)}
                            >
                              Avanzar a {next}
                            </Button>
                          ) : null}
                          {t.status !== "DONE" && t.status !== "BLOCKED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === t.id}
                              onClick={() => setStatus(t, "BLOCKED")}
                            >
                              Marcar bloqueada
                            </Button>
                          ) : null}
                          {t.status !== "DONE" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === t.id}
                              onClick={() => setStatus(t, "DONE")}
                            >
                              Completar
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Completada {fmtDate(t.updated_at)}
                            </span>
                          )}
                        </div>
                      </Panel>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {unassigned.length > 0 ? (
            <section>
              <h2 className="label-caps mb-3">Otras tareas LUXIA</h2>
              <div className="grid gap-4">
                {unassigned.map((t) => (
                  <Panel key={t.id} title={t.priority} action={<StatusBadge status={t.status} />}>
                    <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                    <div className="mt-3 flex gap-2">
                      {NEXT_STATUS[t.status] ? (
                        <Button
                          size="sm"
                          disabled={busy === t.id}
                          onClick={() => setStatus(t, NEXT_STATUS[t.status]!)}
                        >
                          Avanzar a {NEXT_STATUS[t.status]}
                        </Button>
                      ) : null}
                    </div>
                  </Panel>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
