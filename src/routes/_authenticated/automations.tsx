import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { IntegracionesPanel } from "@/components/melano/integraciones-panel";
import { fmtDate, useOrg, useMyRole } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { runN8nAutomation, saveN8nAutomation } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations · n8n — MELANO INC" },
      {
        name: "description",
        content: "Reglas programadas, workflows de n8n y su última ejecución con trace y logs.",
      },
      { property: "og:title", content: "Automations · n8n — MELANO INC" },
      {
        property: "og:description",
        content: "Ejecución automática bidireccional entre el Command Center y n8n.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutomationsPage,
});

type Rule = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  status: string;
  trigger: string;
  schedule_expression: string | null;
  n8n_webhook_url: string | null;
  n8n_workflow: string | null;
  last_run_at: string | null;
  last_result: string | null;
  last_error: string | null;
};

type Run = {
  id: string;
  rule_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  output: string | null;
  error: string | null;
  trace_id: string | null;
};

const INBOUND_PATH = "/api/public/n8n/dispatch";

const N8N_BASE = "https://melanoincorporated.app.n8n.cloud/webhook";

/** Integraciones recomendadas para el Command Center. El webhook es una sugerencia de path:
 *  hay que crear el workflow en n8n y pegar su Production URL real antes de ejecutar. */
const INTEGRATIONS: {
  slug: string;
  name: string;
  category: string;
  description: string;
}[] = [
  {
    slug: "gmail-luxia-followup",
    name: "Gmail · Follow-up LUXIA",
    category: "Comercial",
    description: "Envía el seguimiento por email a leads con próximo contacto vencido.",
  },
  {
    slug: "whatsapp-cloud-outreach",
    name: "WhatsApp Cloud API · Outreach",
    category: "Comercial",
    description: "Primer contacto y recordatorios a inmobiliarias por WhatsApp.",
  },
  {
    slug: "google-calendar-reuniones",
    name: "Google Calendar · Reuniones",
    category: "Comercial",
    description: "Agenda la reunión de fase 1 y sincroniza el próximo contacto del lead.",
  },
  {
    slug: "google-sheets-relevamiento",
    name: "Google Sheets · Relevamiento",
    category: "Datos",
    description: "Importa relevamientos de inmobiliarias y los envía a create_task o leads.",
  },
  {
    slug: "slack-alertas",
    name: "Slack · Alertas ejecutivas",
    category: "Operación",
    description: "Publica alertas críticas y decisiones aprobadas en el canal de dirección.",
  },
  {
    slug: "telegram-bruno",
    name: "Telegram · Aprobaciones Bruno",
    category: "Gobernanza",
    description: "Notifica aprobaciones pendientes y devuelve la decisión al Command Center.",
  },
  {
    slug: "supabase-sync",
    name: "Supabase · Sync operacional",
    category: "Datos",
    description: "Lee y escribe tablas operativas desde workflows con el rol correspondiente.",
  },
  {
    slug: "http-dispatch",
    name: "HTTP Request · Dispatch entrante",
    category: "Núcleo",
    description: "Invoca run_meeting, run_agent, create_task o log en el Command Center.",
  },
  {
    slug: "schedule-0600",
    name: "Schedule Trigger · Ciclo 06:00",
    category: "Núcleo",
    description: "Respaldo del cron diario: dispara la reunión ejecutiva si falla el worker.",
  },
  {
    slug: "openai-enriquecimiento",
    name: "OpenAI · Enriquecimiento de leads",
    category: "IA",
    description: "Normaliza y puntúa datos de contacto antes de crearlos como lead.",
  },
  {
    slug: "hubspot-crm",
    name: "HubSpot · CRM espejo",
    category: "Comercial",
    description: "Refleja clientes y etapas LUXIA en el CRM comercial.",
  },
  {
    slug: "notion-actas",
    name: "Notion · Actas de reunión",
    category: "Operación",
    description: "Guarda el brief ejecutivo y las decisiones como documentación interna.",
  },
  {
    slug: "github-deploys",
    name: "GitHub · Deploys y salud",
    category: "Producto",
    description: "Reporta commits y estados de deploy como señales para el agente CTO.",
  },
  {
    slug: "stripe-mrr",
    name: "Stripe · MRR y cobros",
    category: "Finanzas",
    description: "Actualiza MRR y alerta pagos fallidos para el agente CFO.",
  },
  {
    slug: "drive-propuestas",
    name: "Google Drive · Propuestas",
    category: "Comercial",
    description: "Genera y archiva la propuesta de fase 2 con enlace en el lead.",
  },
];

function AutomationsPage() {
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";
  const qc = useQueryClient();

  const { data: rules, isLoading } = useOrgRows<Rule>("automation_rules", org?.id, {
    order: "created_at",
  });
  const { data: runs } = useOrgRows<Run>("automation_runs", org?.id, {
    order: "started_at",
    limit: 30,
  });

  const save = useServerFn(saveN8nAutomation);
  const trigger = useServerFn(runN8nAutomation);

  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    workflow: "",
    webhookUrl: "",
    enabled: true,
  });
  const [busy, setBusy] = useState<string | null>(null);

  function reset() {
    setForm({ id: "", name: "", description: "", workflow: "", webhookUrl: "", enabled: true });
  }

  async function submit() {
    if (!org?.id) return;
    setBusy("save");
    try {
      await save({
        data: {
          organizationId: org.id,
          id: form.id || undefined,
          name: form.name,
          description: form.description || null,
          workflow: form.workflow || null,
          webhookUrl: form.webhookUrl || null,
          enabled: form.enabled,
        },
      });
      toast.success("Automatización guardada");
      reset();
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }

  async function execute(rule: Rule) {
    if (!org?.id) return;
    setBusy(rule.id);
    try {
      await trigger({ data: { organizationId: org.id, ruleId: rule.id } });
      toast.success(`Workflow ${rule.n8n_workflow ?? rule.name} ejecutado en n8n`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error llamando a n8n");
    } finally {
      setBusy(null);
    }
  }

  const inboundUrl =
    typeof window !== "undefined" ? `${window.location.origin}${INBOUND_PATH}` : INBOUND_PATH;

  return (
    <>
      <PageHeader
        title="Automations · n8n"
        subtitle="Nada es GREEN sin trigger, ejecución, log y resultado. Integración bidireccional con n8n."
      />

      <div className="grid gap-4">
        {isAdmin ? (
          <Panel title="Conectar un workflow de n8n">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Nombre
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Follow-up automático LUXIA"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Workflow en n8n
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.workflow}
                  onChange={(e) => setForm((f) => ({ ...f, workflow: e.target.value }))}
                  placeholder="luxia-followup"
                />
              </label>
              <label className="text-xs text-muted-foreground md:col-span-2">
                Webhook URL (Production URL del nodo Webhook)
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.webhookUrl}
                  onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                  placeholder="https://melanoincorporated.app.n8n.cloud/webhook/…"
                />
              </label>
              <label className="text-xs text-muted-foreground md:col-span-2">
                Descripción
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Qué hace el workflow y cuándo se dispara"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                Activa
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={submit} disabled={busy === "save"}>
                {busy === "save" ? "Guardando…" : form.id ? "Guardar cambios" : "Crear automatización"}
              </Button>
              {form.id ? (
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {isLoading ? (
          <Empty text="Cargando…" />
        ) : (rules ?? []).length === 0 ? (
          <Empty text="Sin automatizaciones configuradas." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(rules ?? []).map((r) => {
              const lastRuns = (runs ?? []).filter((x) => x.rule_id === r.id).slice(0, 3);
              return (
                <Panel
                  key={r.id}
                  title={r.name}
                  action={<StatusBadge status={r.enabled ? "ACTIVE" : "PAUSED"} />}
                >
                  <p className="text-sm text-muted-foreground">{r.description ?? "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Trigger: {r.trigger}</span>
                    <span>Schedule: {r.schedule_expression ?? "—"}</span>
                    <span>Último run: {fmtDate(r.last_run_at)}</span>
                    <span>Estado: {r.status ?? "—"}</span>
                  </div>
                  {r.n8n_webhook_url ? (
                    <p className="mt-2 break-all text-[11px] text-muted-foreground">
                      n8n: {r.n8n_workflow ?? "workflow"} · {r.n8n_webhook_url}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">Sin webhook de n8n.</p>
                  )}
                  {r.last_error ? (
                    <p className="mt-2 text-xs text-destructive">{r.last_error}</p>
                  ) : r.last_result ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">{r.last_result}</p>
                  ) : null}

                  {lastRuns.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                      {lastRuns.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={x.status} />
                          <span>{fmtDate(x.started_at)}</span>
                          <span>trace {x.trace_id ? x.trace_id.slice(0, 8) : "—"}</span>
                          {x.error ? <span className="text-destructive">{x.error}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {isAdmin ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => execute(r)}
                        disabled={!r.n8n_webhook_url || busy === r.id}
                      >
                        {busy === r.id ? "Ejecutando…" : "Ejecutar en n8n"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            name: r.name,
                            description: r.description ?? "",
                            workflow: r.n8n_workflow ?? "",
                            webhookUrl: r.n8n_webhook_url ?? "",
                            enabled: r.enabled,
                          })
                        }
                      >
                        Editar
                      </Button>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        )}

        <RoleGate allow={["CEO", "ADMIN"]}>
          <Panel title="15 integraciones disponibles en n8n">
            <p className="text-sm text-muted-foreground">
              Elegí una integración: se precarga el formulario de arriba con nombre, workflow y un
              path sugerido. Creá el workflow en n8n y reemplazá el webhook por su{" "}
              <strong>Production URL</strong> real antes de ejecutar.
            </p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {INTEGRATIONS.map((i) => (
                <li
                  key={i.slug}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{i.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {i.category}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: "",
                        name: i.name,
                        description: i.description,
                        workflow: i.slug,
                        webhookUrl: `${N8N_BASE}/${i.slug}`,
                        enabled: true,
                      })
                    }
                  >
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </RoleGate>

        <RoleGate allow={["CEO", "ADMIN"]}>
          <Panel title="Entrada desde n8n (n8n → Command Center)">
            <p className="text-sm text-muted-foreground">
              Configurá en n8n un nodo <strong>HTTP Request</strong> con método POST hacia esta URL y
              el header <code>Authorization: Bearer &lt;LOVABLE_CRON_SECRET&gt;</code>.
            </p>
            <pre className="mt-3 overflow-auto rounded bg-muted/40 p-3 text-[11px] leading-relaxed">
{`POST ${inboundUrl}
Authorization: Bearer <LOVABLE_CRON_SECRET>
Content-Type: application/json

{ "action": "run_meeting" }
{ "action": "run_agent", "agentCode": "CRO" }
{ "action": "create_task", "title": "Contactar inmobiliaria", "priority": "P1" }
{ "action": "log", "message": "workflow terminado", "detail": { "leads": 12 } }`}
            </pre>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Toda ejecución entrante queda registrada en Activity con su trace.
            </p>
          </Panel>
        </RoleGate>
      </div>
    </>
  );
}
