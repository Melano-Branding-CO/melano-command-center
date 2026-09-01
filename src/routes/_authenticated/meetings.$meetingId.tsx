import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge, PriorityBadge } from "@/components/melano/badges";
import { fmtDate, useOrg, agentMap } from "@/lib/melano";
import { useOrgRows, useRowById } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/meetings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Reunión ejecutiva — MELANO INC" },
      {
        name: "description",
        content: "Lectura completa del brief, la intervención de cada agente y los casos derivados.",
      },
      { property: "og:title", content: "Reunión ejecutiva — MELANO INC" },
      {
        property: "og:description",
        content: "Brief consolidado, respuestas por agente, decisiones y tareas de la reunión.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetingDetail,
});

type Meeting = {
  id: string;
  title: string;
  status: string;
  trigger: string;
  trace_id: string;
  started_at: string | null;
  finished_at: string | null;
  scheduled_for: string;
  summary: string | null;
  error: string | null;
  executive_brief: unknown;
};

type Output = {
  id: string;
  agent_id: string;
  situation: string | null;
  changes: string | null;
  problems: string | null;
  opportunities: string | null;
  proposed_action: string | null;
  metrics: unknown;
  raw: unknown;
  created_at: string;
};

type DecisionRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  reasoning_summary: string | null;
  expected_impact: string | null;
  risk: string | null;
  confidence: number;
  source_agent: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  why_now: string | null;
  next_action: string | null;
  success_metric: string | null;
  assigned_agent: string | null;
};

type AgentRow = { id: string; name: string; code: string; role: string };

/** Aplana cualquier valor del modelo a texto legible. */
function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${asText(v)}`)
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = asText(value);
  if (!text) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function MeetingDetail() {
  const { meetingId } = Route.useParams();
  const { data: org } = useOrg();
  const { data: meeting, isLoading } = useRowById<Meeting>("executive_meetings", meetingId);
  const { data: outputs } = useOrgRows<Output>("meeting_outputs", org?.id, {
    eq: { meeting_id: meetingId },
    order: "created_at",
    asc: true,
  });
  const { data: decisions } = useOrgRows<DecisionRow>("decisions", org?.id, {
    eq: { meeting_id: meetingId },
    order: "created_at",
    asc: true,
  });
  const { data: tasks } = useOrgRows<TaskRow>("tasks", org?.id, {
    eq: { meeting_id: meetingId },
    order: "created_at",
    asc: true,
  });
  const { data: agents } = useOrgRows<AgentRow>("agents", org?.id, { order: "sort_order", asc: true });
  const byAgent = agentMap(agents as never);
  const { data: n8nLogs } = useTaskN8nLogs(org?.id, 100);
  const n8nByTask = new Map<string, TaskN8nLog[]>();
  for (const log of n8nLogs ?? []) {
    if (!log.entity_id) continue;
    n8nByTask.set(log.entity_id, [...(n8nByTask.get(log.entity_id) ?? []), log]);
  }

  if (isLoading) return <Empty text="Cargando…" />;
  if (!meeting) return <Empty text="Reunión no encontrada." />;

  const brief = meeting.executive_brief as Record<string, unknown> | null;

  return (
    <>
      <PageHeader
        title={meeting.title || "Reunión ejecutiva"}
        subtitle={`${fmtDate(meeting.started_at)} · trace ${meeting.trace_id?.slice(0, 8) ?? "—"} · ${meeting.trigger}`}
        actions={
          <Link to="/meetings" className="text-sm text-muted-foreground hover:underline">
            Volver
          </Link>
        }
      />

      <div className="grid gap-4">
        <Panel title="Brief ejecutivo" action={<StatusBadge status={meeting.status} />}>
          {meeting.error ? <p className="mb-2 text-sm text-destructive">{meeting.error}</p> : null}
          <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.summary ?? "—"}</p>
          {brief ? (
            <div className="mt-3 space-y-2">
              <Field label="Estado general" value={brief["situation"] ?? brief["estado"]} />
              <Field label="Top 3 prioridades" value={brief["top_priorities"] ?? brief["prioridades"]} />
              <Field label="Riesgos" value={brief["risks"] ?? brief["riesgos"]} />
              <details>
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  Ver brief completo (JSON)
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(brief, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Finalizada: {fmtDate(meeting.finished_at)}
          </p>
        </Panel>

        <Panel title={`Respuestas por agente (${outputs?.length ?? 0})`}>
          {(outputs ?? []).length === 0 ? (
            <Empty text="Esta reunión no registró intervenciones de agentes." />
          ) : (
            <ul className="space-y-3">
              {(outputs ?? []).map((o) => {
                const a = byAgent.get(o.agent_id);
                return (
                  <li key={o.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {a?.name ?? "Agente"}{" "}
                        <span className="text-[11px] text-muted-foreground">
                          {a?.code ? `· ${a.code}` : ""} {a?.role ? `· ${a.role}` : ""}
                        </span>
                      </p>
                      <span className="text-[11px] text-muted-foreground">{fmtDate(o.created_at)}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <Field label="Situación" value={o.situation} />
                      <Field label="Cambios" value={o.changes} />
                      <Field label="Problemas" value={o.problems} />
                      <Field label="Oportunidades" value={o.opportunities} />
                      <Field label="Métricas" value={o.metrics} />
                      <Field label="Acción propuesta" value={o.proposed_action} />
                      {o.raw ? (
                        <details>
                          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                            Ver respuesta cruda
                          </summary>
                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(o.raw, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Decisiones (${decisions?.length ?? 0})`}>
            {(decisions ?? []).length === 0 ? (
              <Empty text="Sin decisiones derivadas." />
            ) : (
              <ul className="space-y-3">
                {(decisions ?? []).map((d) => (
                  <li key={d.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{d.title}</p>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={d.priority} />
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      <Field label="Descripción" value={d.description} />
                      <Field label="Razonamiento" value={d.reasoning_summary} />
                      <Field label="Impacto esperado" value={d.expected_impact} />
                      <Field label="Riesgo" value={d.risk} />
                      <p className="text-[11px] text-muted-foreground">
                        Confianza {(Number(d.confidence) * 100).toFixed(0)}% ·{" "}
                        {d.source_agent ? (byAgent.get(d.source_agent)?.name ?? "—") : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Tareas generadas (${tasks?.length ?? 0})`}>
            {(tasks ?? []).length === 0 ? (
              <Empty text="Sin tareas derivadas." />
            ) : (
              <ul className="space-y-3">
                {(tasks ?? []).map((t) => (
                  <li key={t.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      <Field label="Descripción" value={t.description} />
                      <Field label="Por qué ahora" value={t.why_now} />
                      <Field label="Próxima acción" value={t.next_action} />
                      <Field label="Métrica de éxito" value={t.success_metric} />
                      <p className="text-[11px] text-muted-foreground">
                        Agente: {t.assigned_agent ? (byAgent.get(t.assigned_agent)?.name ?? "—") : "—"}
                      </p>
                      <RunTaskInN8nButton organizationId={org?.id} taskId={t.id} />
                      {n8nByTask.get(t.id)?.length ? (
                        <TaskN8nLogList logs={n8nByTask.get(t.id) ?? []} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
