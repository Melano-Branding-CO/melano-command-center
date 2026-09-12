import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/melano";

type WorkflowState = "ACTIVE" | "BLOCKED" | "PENDING_CONFIG" | "PAUSED";

type RegistryRow = {
  id: string;
  tenant_id: string;
  title: string;
  badge: string | null;
  state: string;
  enabled: boolean;
  fields: Record<string, unknown> | null;
  updated_at: string;
};

type WorkflowView = {
  id: string;
  name: string;
  state: WorkflowState;
  workflowId: string | null;
  published: boolean;
  triggerCount: number;
  triggerType: string | null;
  webhookUrl: string | null;
  lastExecutionId: string | null;
  lastExecutionStatus: string | null;
  lastExecutionAt: string | null;
  blocker: string | null;
  source: string | null;
};

const CANONICAL_N8N_HOST = "melanoinc.app.n8n.cloud";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations · n8n — MELANO INC" },
      {
        name: "description",
        content: "Estado verificable de workflows n8n: publicación, trigger y última ejecución real.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutomationsPage,
});

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeState(row: RegistryRow): WorkflowState {
  const fields = row.fields ?? {};
  const explicit = String(row.state ?? "").toUpperCase();
  if (explicit === "BLOCKED") return "BLOCKED";
  if (explicit === "PENDING_CONFIG") return "PENDING_CONFIG";
  if (explicit === "PAUSED") return "PAUSED";
  if (!row.enabled) return "PAUSED";
  if (!asBoolean(fields["published"])) return "PENDING_CONFIG";
  return "ACTIVE";
}

function toView(row: RegistryRow): WorkflowView {
  const fields = row.fields ?? {};
  return {
    id: row.id,
    name: row.title,
    state: normalizeState(row),
    workflowId: asString(fields["workflow_id"]),
    published: asBoolean(fields["published"]),
    triggerCount: asNumber(fields["trigger_count"]),
    triggerType: asString(fields["trigger_type"]),
    webhookUrl: asString(fields["webhook_url"]),
    lastExecutionId: asString(fields["last_execution_id"]),
    lastExecutionStatus: asString(fields["last_execution_status"]),
    lastExecutionAt: asString(fields["last_execution_at"]),
    blocker: asString(fields["blocker"]),
    source: asString(fields["source"]),
  };
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function isCanonicalWebhook(url: string | null) {
  if (!url) return true;
  try {
    return new URL(url).host === CANONICAL_N8N_HOST;
  } catch {
    return false;
  }
}

function AutomationsPage() {
  const { data: org } = useOrg();
  const { data, isLoading, error } = useQuery({
    queryKey: ["verified-n8n-registry", org?.id],
    enabled: !!org?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: rows, error: queryError } = await (supabase as unknown as {
        from: (table: string) => any;
      })
        .from("routing_rules")
        .select("id, tenant_id, title, badge, state, enabled, fields, updated_at")
        .eq("tenant_id", org!.id)
        .eq("fields->>kind", "n8n_workflow")
        .order("updated_at", { ascending: false });

      if (queryError) throw queryError;
      return ((rows ?? []) as RegistryRow[]).map(toView);
    },
  });

  const workflows = data ?? [];
  const counts = workflows.reduce(
    (acc, workflow) => {
      acc[workflow.state] += 1;
      return acc;
    },
    { ACTIVE: 0, BLOCKED: 0, PENDING_CONFIG: 0, PAUSED: 0 } as Record<WorkflowState, number>,
  );

  const legacyHostCount = workflows.filter((w) => !isCanonicalWebhook(w.webhookUrl)).length;

  return (
    <>
      <PageHeader
        title="Automations · n8n"
        subtitle="Fuente de verdad: workflow publicado + trigger real + última ejecución verificable."
      />

      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["ACTIVE", "BLOCKED", "PENDING_CONFIG", "PAUSED"] as WorkflowState[]).map((state) => (
            <Panel key={state} title={state}>
              <p className="text-3xl font-semibold text-foreground">{counts[state]}</p>
            </Panel>
          ))}
        </div>

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
                {busy === "save"
                  ? "Guardando…"
                  : form.id
                    ? "Guardar cambios"
                    : "Crear automatización"}
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
          <Empty text="Consultando registro canónico de automatizaciones…" />
        ) : error ? (
          <Panel title="Error leyendo runtime">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "No se pudo leer el registro canónico."}
            </p>
          </Panel>
        ) : workflows.length === 0 ? (
          <Empty text="No hay workflows n8n verificados para este tenant." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {workflows.map((workflow) => {
              const canonicalWebhook = isCanonicalWebhook(workflow.webhookUrl);
              const lastSuccess = workflow.lastExecutionStatus?.toLowerCase() === "success";
              return (
                <Panel
                  key={workflow.id}
                  title={workflow.name}
                  action={<StatusBadge status={workflow.state} />}
                >
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <span className="label-caps">Workflow ID</span>
                      <p className="mt-1 break-all text-foreground">{workflow.workflowId ?? "—"}</p>
                    </div>
                    <div>
                      <span className="label-caps">Publicado</span>
                      <p className="mt-1 text-foreground">{workflow.published ? "Sí" : "No"}</p>
                    </div>
                    <div>
                      <span className="label-caps">Trigger</span>
                      <p className="mt-1 text-foreground">
                        {workflow.triggerType ?? "—"} · {workflow.triggerCount} trigger(s)
                      </p>
                    </div>
                    <div>
                      <span className="label-caps">Última ejecución</span>
                      <p className="mt-1 text-foreground">{fmtDate(workflow.lastExecutionAt)}</p>
                    </div>
                    <div>
                      <span className="label-caps">Execution ID</span>
                      <p className="mt-1 text-foreground">{workflow.lastExecutionId ?? "—"}</p>
                    </div>
                    <div>
                      <span className="label-caps">Resultado</span>
                      <p className={lastSuccess ? "mt-1 text-emerald-400" : "mt-1 text-foreground"}>
                        {workflow.lastExecutionStatus?.toUpperCase() ?? "SIN EVIDENCIA"}
                      </p>
                    </div>
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
                    <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                      {r.last_result}
                    </p>
                  ) : null}

                  {workflow.blocker ? (
                    <p className="mt-3 text-xs text-destructive">BLOCKEO: {workflow.blocker}</p>
                  ) : null}

                  {workflow.state === "ACTIVE" && !workflow.lastExecutionId ? (
                    <p className="mt-3 text-xs text-amber-300">
                      Publicado, pero todavía sin execution ID reciente registrado. No se considera GREEN de ejecución.
                    </p>
                  ) : null}

                  {!canonicalWebhook ? (
                    <p className="mt-3 text-xs text-destructive">
                      Host no canónico. Debe apuntar a https://{CANONICAL_N8N_HOST}/… antes de considerarse operativo.
                    </p>
                  ) : null}

                  <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                    fuente: {workflow.source ?? "sin evidencia"}
                  </p>
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
              Configurá en n8n un nodo <strong>HTTP Request</strong> con método POST hacia esta URL
              y el header <code>Authorization: Bearer &lt;LOVABLE_CRON_SECRET&gt;</code>.
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
