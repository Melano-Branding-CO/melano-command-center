import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg, useAgents, useSession } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads · LUXIA — MELANO INC" },
      {
        name: "description",
        content:
          "Cohorte de leads de LUXIA con avance controlado por el flujo 0–14, 15–45 y 46–90 días.",
      },
      { property: "og:title", content: "Leads · LUXIA — MELANO INC" },
      {
        property: "og:description",
        content: "Gestión de la cohorte de leads de LUXIA con trazabilidad por fase y estado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadsPage,
});

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
  source: string | null;
  cohort: string;
  interest: string | null;
  zone: string | null;
  budget: number | null;
  currency: string;
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
  created_at: string;
};

const PHASES: { key: Phase; label: string; desc: string }[] = [
  {
    key: "FASE_0_14",
    label: "Fase 0–14 días",
    desc: "Contacto inicial, validación de datos y calificación básica.",
  },
  {
    key: "FASE_15_45",
    label: "Fase 15–45 días",
    desc: "Seguimiento sistemático, visita/propuesta y negociación.",
  },
  {
    key: "FASE_46_90",
    label: "Fase 46–90 días",
    desc: "Cierre, reactivación de fríos y revenue recurrente.",
  },
];

const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  FASE_0_14: "FASE_15_45",
  FASE_15_45: "FASE_46_90",
};
const PREV_PHASE: Partial<Record<Phase, Phase>> = {
  FASE_15_45: "FASE_0_14",
  FASE_46_90: "FASE_15_45",
};

const STATUSES: LeadStatus[] = [
  "NUEVO",
  "CONTACTADO",
  "CALIFICADO",
  "NEGOCIACION",
  "GANADO",
  "PERDIDO",
  "DESCARTADO",
];

const PHASE_LABEL: Record<Phase, string> = {
  FASE_0_14: "0–14",
  FASE_15_45: "15–45",
  FASE_46_90: "46–90",
};

function db() {
  return supabase as unknown as { from: (t: string) => any };
}

function LeadsPage() {
  const { data: org } = useOrg();
  const { data: session } = useSession();
  useRealtime(["leads", "lead_events"]);
  const { data: agents } = useAgents(org?.id);
  const luxia = (agents ?? []).find((a) => a.code === "LUXIA");

  const { data: leads, isLoading } = useOrgRows<Lead>("leads", org?.id, {
    order: "created_at",
    asc: false,
  });
  const { data: events } = useOrgRows<LeadEvent>("lead_events", org?.id, {
    order: "created_at",
    limit: 200,
  });

  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", zone: "" });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = (leads ?? []).filter((l) => l.cohort === "LUXIA" || !l.cohort);
    if (!term) return base;
    return base.filter((l) =>
      `${l.full_name} ${l.email ?? ""} ${l.phone ?? ""} ${l.zone ?? ""} ${l.source ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [leads, q]);

  const eventsByLead = useMemo(() => {
    const map = new Map<string, LeadEvent[]>();
    for (const e of events ?? []) {
      const list = map.get(e.lead_id) ?? [];
      list.push(e);
      map.set(e.lead_id, list);
    }
    return map;
  }, [events]);

  async function logEvent(
    lead: Lead,
    action: string,
    from: string | null,
    to: string | null,
  ) {
    await db()
      .from("lead_events")
      .insert({
        organization_id: org!.id,
        lead_id: lead.id,
        actor_user: session?.user?.id ?? null,
        actor_agent: luxia?.id ?? null,
        action,
        from_value: from,
        to_value: to,
      });
  }

  async function movePhase(lead: Lead, phase: Phase) {
    setBusy(lead.id);
    try {
      const { error } = await db().from("leads").update({ phase }).eq("id", lead.id);
      if (error) throw error;
      await logEvent(lead, "lead.phase_changed", lead.phase, phase);
      await db()
        .from("activity_logs")
        .insert({
          organization_id: org!.id,
          actor_type: "human",
          action: "lead.phase_changed",
          entity_type: "lead",
          entity_id: lead.id,
          detail: { from: lead.phase, to: phase, screen: "leads" },
        });
      toast.success(`${lead.full_name} → fase ${PHASE_LABEL[phase]}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo mover el lead");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(lead: Lead, status: LeadStatus) {
    setBusy(lead.id);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "CONTACTADO") patch["last_contact_at"] = new Date().toISOString();
      const { error } = await db().from("leads").update(patch).eq("id", lead.id);
      if (error) throw error;
      await logEvent(lead, "lead.status_changed", lead.status, status);
      toast.success(`${lead.full_name} → ${status}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    } finally {
      setBusy(null);
    }
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setBusy("new");
    try {
      const { error } = await db()
        .from("leads")
        .insert({
          organization_id: org!.id,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          source: form.source.trim() || null,
          zone: form.zone.trim() || null,
          cohort: "LUXIA",
          assigned_agent: luxia?.id ?? null,
          owner_user: session?.user?.id ?? null,
        });
      if (error) throw error;
      toast.success("Lead cargado en la cohorte LUXIA");
      setForm({ full_name: "", email: "", phone: "", source: "", zone: "" });
      setCreating(false);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el lead");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Leads · LUXIA"
        subtitle="Cohorte real de leads inmobiliarios con avance controlado por fases 0–14 / 15–45 / 46–90."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono o zona"
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancelar" : "Nuevo lead"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} lead{filtered.length === 1 ? "" : "s"} en la cohorte
        </span>
      </div>

      {creating ? (
        <Panel title="Alta de lead verificado">
          <form className="grid gap-3 sm:grid-cols-5" onSubmit={createLead}>
            <Input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Nombre y apellido"
            />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
            />
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Teléfono"
            />
            <Input
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              placeholder="Zona"
            />
            <div className="flex gap-2">
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Origen"
              />
              <Button type="submit" size="sm" disabled={busy === "new"}>
                Guardar
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {isLoading ? (
        <Empty text="Cargando cohorte…" />
      ) : filtered.length === 0 ? (
        <Empty text="Sin leads cargados. La cohorte se carga con datos verificados; no se muestran valores estimados." />
      ) : (
        <div className="mt-6 grid gap-8">
          {PHASES.map((phase) => {
            const rows = filtered.filter((l) => l.phase === phase.key);
            return (
              <section key={phase.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="label-caps">{phase.label}</h2>
                  <span className="text-xs text-muted-foreground">{rows.length}</span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{phase.desc}</p>
                {rows.length === 0 ? (
                  <Empty text="Sin leads en esta fase." />
                ) : (
                  <div className="grid gap-4">
                    {rows.map((lead) => {
                      const next = NEXT_PHASE[lead.phase];
                      const prev = PREV_PHASE[lead.phase];
                      const hist = eventsByLead.get(lead.id) ?? [];
                      return (
                        <Panel
                          key={lead.id}
                          title={PHASE_LABEL[lead.phase]}
                          action={<StatusBadge status={lead.status} />}
                        >
                          <h3 className="text-sm font-semibold text-foreground">
                            {lead.full_name}
                          </h3>
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
                              <dt className="label-caps">Origen</dt>
                              <dd className="text-foreground">{lead.source ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="label-caps">Último contacto</dt>
                              <dd className="text-foreground">{fmtDate(lead.last_contact_at)}</dd>
                            </div>
                          </dl>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {prev ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === lead.id}
                                onClick={() => movePhase(lead, prev)}
                              >
                                ← Fase {PHASE_LABEL[prev]}
                              </Button>
                            ) : null}
                            {next ? (
                              <Button
                                size="sm"
                                disabled={busy === lead.id}
                                onClick={() => movePhase(lead, next)}
                              >
                                Avanzar a fase {PHASE_LABEL[next]} →
                              </Button>
                            ) : null}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {STATUSES.filter((s) => s !== lead.status).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                disabled={busy === lead.id}
                                onClick={() => setStatus(lead, s)}
                              >
                                {s}
                              </Button>
                            ))}
                          </div>

                          {hist.length > 0 ? (
                            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                              {hist.slice(0, 3).map((e) => (
                                <li key={e.id}>
                                  {fmtDate(e.created_at)} · {e.action}
                                  {e.from_value ? ` · ${e.from_value} → ${e.to_value}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </Panel>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
