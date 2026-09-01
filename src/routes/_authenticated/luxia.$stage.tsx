import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useAgents, useOrg, useSession } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { cn } from "@/lib/utils";

type Phase = "FASE_0_14" | "FASE_15_45" | "FASE_46_90";
type LeadStatus =
  | "NUEVO"
  | "CONTACTADO"
  | "CALIFICADO"
  | "NEGOCIACION"
  | "GANADO"
  | "PERDIDO"
  | "DESCARTADO";

type Lead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  zone: string | null;
  source: string | null;
  cohort: string;
  phase: Phase;
  status: LeadStatus;
  notes: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type LeadEvent = {
  id: string;
  lead_id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
};

type StageKey = "reunion" | "propuesta" | "aprobacion" | "contrato";

type StageConfig = {
  key: StageKey;
  label: string;
  title: string;
  subtitle: string;
  /** Qué se busca en esta etapa. */
  objective: string;
  /** Acciones concretas que debe ejecutar el operador. */
  actions: string[];
  /** Criterio que debe cumplirse para avanzar. */
  exitCriteria: string[];
  /** Ejemplos de notas/evidencia válidas. */
  examples: string[];
  /** Estados que pertenecen a esta etapa del embudo LUXIA. */
  from: LeadStatus[];
  /** Estado y fase al avanzar. */
  toStatus: LeadStatus;
  toPhase: Phase;
  action: string;
  cta: string;
  next?: StageKey;
};

const STAGES: StageConfig[] = [
  {
    key: "reunion",
    label: "1 · Reunión",
    title: "LUXIA · Reunión",
    subtitle:
      "Contacto inicial y reunión de diagnóstico. Al registrar la reunión, el lead avanza a propuesta.",
    from: ["NUEVO", "CONTACTADO"],
    toStatus: "CALIFICADO",
    toPhase: "FASE_0_14",
    action: "luxia.meeting_completed",
    cta: "Registrar reunión y avanzar a Propuesta",
    next: "propuesta",
  },
  {
    key: "propuesta",
    label: "2 · Propuesta",
    title: "LUXIA · Propuesta",
    subtitle:
      "Propuesta económica y alcance enviados. Al enviarla, el lead pasa a negociación y fase 15–45.",
    from: ["CALIFICADO"],
    toStatus: "NEGOCIACION",
    toPhase: "FASE_15_45",
    action: "luxia.proposal_sent",
    cta: "Registrar propuesta enviada y avanzar a Aprobación",
    next: "aprobacion",
  },
  {
    key: "aprobacion",
    label: "3 · Aprobación",
    title: "LUXIA · Aprobación",
    subtitle:
      "Confirmación comercial del cliente. Requiere evidencia registrada antes de pasar a contrato.",
    from: ["NEGOCIACION"],
    toStatus: "GANADO",
    toPhase: "FASE_15_45",
    action: "luxia.approved",
    cta: "Registrar aprobación y avanzar a Contrato",
    next: "contrato",
  },
  {
    key: "contrato",
    label: "4 · Contrato",
    title: "LUXIA · Contrato",
    subtitle:
      "Firma y alta operativa. Al firmar, el lead queda en fase 46–90 para onboarding y revenue recurrente.",
    from: ["GANADO"],
    toStatus: "GANADO",
    toPhase: "FASE_46_90",
    action: "luxia.contract_signed",
    cta: "Registrar contrato firmado",
  },
];

const STAGE_BY_KEY = new Map(STAGES.map((s) => [s.key, s]));

const PHASE_LABEL: Record<Phase, string> = {
  FASE_0_14: "0–14",
  FASE_15_45: "15–45",
  FASE_46_90: "46–90",
};

export const Route = createFileRoute("/_authenticated/luxia/$stage")({
  beforeLoad: ({ params }) => {
    if (!STAGE_BY_KEY.has(params.stage as StageKey)) throw notFound();
  },
  head: ({ params }) => {
    const stage = STAGE_BY_KEY.get(params.stage as StageKey);
    const title = `${stage?.title ?? "LUXIA"} — MELANO INC`;
    const description =
      stage?.subtitle ?? "Etapas del proceso comercial LUXIA con trazabilidad por lead.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: StageGuarded,
  notFoundComponent: () => <Empty text="Etapa de LUXIA inexistente." />,
  errorComponent: () => <Empty text="No se pudo cargar la etapa de LUXIA." />,
});

function db() {
  return supabase as unknown as { from: (t: string) => any };
}

function StageGuarded() {
  return (
    <RoleGate allow={["CEO", "ADMIN"]}>
      <StagePage />
    </RoleGate>
  );
}

function StagePage() {
  const { stage: stageParam } = Route.useParams();
  const stage = STAGE_BY_KEY.get(stageParam as StageKey)!;
  const { data: org } = useOrg();
  const { data: session } = useSession();
  const { data: agents } = useAgents(org?.id);
  const luxia = (agents ?? []).find((a) => a.code === "LUXIA");
  useRealtime(["leads", "lead_events"]);

  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: leads, isLoading } = useOrgRows<Lead>("leads", org?.id, {
    order: "created_at",
    asc: false,
    limit: 500,
  });
  const { data: events } = useOrgRows<LeadEvent>("lead_events", org?.id, {
    order: "created_at",
    limit: 400,
  });

  const allLeads = useMemo(
    () => (leads ?? []).filter((l) => l.cohort === "LUXIA" || !l.cohort),
    [leads],
  );

  const counts = useMemo(() => {
    const map: Record<StageKey, number> = {
      reunion: 0,
      propuesta: 0,
      aprobacion: 0,
      contrato: 0,
    };
    for (const s of STAGES) {
      map[s.key] = allLeads.filter(
        (l) =>
          s.from.includes(l.status) &&
          (s.key !== "contrato" || l.phase !== "FASE_46_90") &&
          (s.key !== "aprobacion" || l.status === "NEGOCIACION"),
      ).length;
    }
    return map;
  }, [allLeads]);

  const rows = useMemo(() => {
    if (stage.key === "contrato") {
      return allLeads.filter((l) => l.status === "GANADO");
    }
    return allLeads.filter((l) => stage.from.includes(l.status));
  }, [allLeads, stage]);

  const eventsByLead = useMemo(() => {
    const map = new Map<string, LeadEvent[]>();
    for (const e of events ?? []) {
      const list = map.get(e.lead_id) ?? [];
      list.push(e);
      map.set(e.lead_id, list);
    }
    return map;
  }, [events]);

  async function advance(lead: Lead) {
    if (!org?.id) return;
    setBusy(lead.id);
    const note = (notes[lead.id] ?? "").trim() || null;
    try {
      const { error } = await db()
        .from("leads")
        .update({
          status: stage.toStatus,
          phase: stage.toPhase,
          last_contact_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      if (error) throw error;

      const { error: evError } = await db()
        .from("lead_events")
        .insert({
          organization_id: org.id,
          lead_id: lead.id,
          actor_user: session?.user?.id ?? null,
          actor_agent: luxia?.id ?? null,
          action: stage.action,
          from_value: `${lead.status} · ${PHASE_LABEL[lead.phase]}`,
          to_value: `${stage.toStatus} · ${PHASE_LABEL[stage.toPhase]}`,
          note,
        });
      if (evError) throw evError;

      const { error: logError } = await db()
        .from("activity_logs")
        .insert({
          organization_id: org.id,
          actor_type: "human",
          actor_user: session?.user?.id ?? null,
          action: stage.action,
          entity_type: "lead",
          entity_id: lead.id,
          detail: {
            screen: `luxia/${stage.key}`,
            lead: lead.full_name,
            from_status: lead.status,
            to_status: stage.toStatus,
            from_phase: lead.phase,
            to_phase: stage.toPhase,
            note,
          },
        });
      if (logError) throw logError;

      setNotes((prev) => ({ ...prev, [lead.id]: "" }));
      toast.success(`${lead.full_name}: ${stage.action.replace("luxia.", "")} registrado`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el avance");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title={stage.title}
        subtitle={stage.subtitle}
        actions={
          <Link
            to="/leads"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver cohorte completa
          </Link>
        }
      />

      <nav className="mb-6 flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <Link
            key={s.key}
            to="/luxia/$stage"
            params={{ stage: s.key }}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs transition-colors",
              s.key === stage.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
            <span
              className={cn(
                "rounded px-1.5 text-[11px] font-semibold",
                s.key === stage.key ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {counts[s.key]}
            </span>
          </Link>
        ))}
      </nav>

      {isLoading ? (
        <Empty text="Cargando leads de la etapa…" />
      ) : rows.length === 0 ? (
        <Empty text="Sin leads en esta etapa. Los registros aparecen aquí cuando alcanzan el estado correspondiente." />
      ) : (
        <div className="grid gap-4">
          {rows.map((lead) => {
            const hist = (eventsByLead.get(lead.id) ?? []).slice(0, 5);
            return (
              <Panel
                key={lead.id}
                title={`Fase ${PHASE_LABEL[lead.phase]}`}
                action={<StatusBadge status={lead.status} />}
              >
                <h3 className="text-sm font-semibold text-foreground">{lead.full_name}</h3>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="label-caps">Contacto</dt>
                    <dd className="truncate text-foreground">
                      {lead.email ?? lead.phone ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Zona</dt>
                    <dd className="text-foreground">{lead.zone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Último contacto</dt>
                    <dd className="text-foreground">{fmtDate(lead.last_contact_at)}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Próximo contacto</dt>
                    <dd className="text-foreground">
                      {lead.next_follow_up_at ? fmtDate(lead.next_follow_up_at) : "Sin programar"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Input
                    value={notes[lead.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [lead.id]: e.target.value })}
                    placeholder="Evidencia o nota del avance (opcional)"
                    className="h-9 max-w-sm text-xs"
                  />
                  <Button size="sm" disabled={busy === lead.id} onClick={() => advance(lead)}>
                    {busy === lead.id ? "Registrando…" : stage.cta}
                  </Button>
                  {stage.next ? (
                    <Link
                      to="/luxia/$stage"
                      params={{ stage: stage.next }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Ir a la etapa siguiente
                    </Link>
                  ) : null}
                </div>

                {hist.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    {hist.map((e) => (
                      <li key={e.id}>
                        {fmtDate(e.created_at)} · {e.action}
                        {e.from_value ? ` · ${e.from_value} → ${e.to_value}` : ""}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    Sin eventos registrados para este lead.
                  </p>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
