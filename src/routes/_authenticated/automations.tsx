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
  if (!asBoolean(fields.published)) return "PENDING_CONFIG";
  return "ACTIVE";
}

function toView(row: RegistryRow): WorkflowView {
  const fields = row.fields ?? {};
  return {
    id: row.id,
    name: row.title,
    state: normalizeState(row),
    workflowId: asString(fields.workflow_id),
    published: asBoolean(fields.published),
    triggerCount: asNumber(fields.trigger_count),
    triggerType: asString(fields.trigger_type),
    webhookUrl: asString(fields.webhook_url),
    lastExecutionId: asString(fields.last_execution_id),
    lastExecutionStatus: asString(fields.last_execution_status),
    lastExecutionAt: asString(fields.last_execution_at),
    blocker: asString(fields.blocker),
    source: asString(fields.source),
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

        {legacyHostCount > 0 ? (
          <Panel title="Host legacy detectado">
            <p className="text-sm text-destructive">
              {legacyHostCount} workflow(s) apuntan fuera de {CANONICAL_N8N_HOST}. No se consideran GREEN.
            </p>
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

                  {workflow.webhookUrl ? (
                    <div className="mt-3 rounded-md border border-border/60 p-2 text-[11px]">
                      <span className="label-caps">Webhook</span>
                      <p className={`mt-1 break-all ${canonicalWebhook ? "text-foreground" : "text-destructive"}`}>
                        {workflow.webhookUrl}
                      </p>
                    </div>
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

        <Panel title="Criterio GREEN">
          <p className="text-sm text-muted-foreground">
            GREEN requiere: workflow publicado, trigger real, host canónico cuando existe webhook, ejecución terminal
            reciente y evidencia de SUCCESS. Un registro sin workflow real queda PENDING_CONFIG; un bloqueo técnico
            queda BLOCKED; PAUSED se reserva para una pausa explícita.
          </p>
        </Panel>
      </div>
    </>
  );
}
