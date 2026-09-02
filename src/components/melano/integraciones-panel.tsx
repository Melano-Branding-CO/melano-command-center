import { Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate } from "@/lib/melano";

type RuleLike = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  status: string;
  n8n_workflow: string | null;
  n8n_webhook_url: string | null;
  last_run_at: string | null;
  last_error: string | null;
};

type RunLike = {
  id: string;
  rule_id: string;
  status: string;
  started_at: string;
  trace_id: string | null;
};

/** Metadatos declarativos de las integraciones montadas en n8n.
 *  `credential` es la credencial real configurada en la instancia de n8n. */
const CATALOG: Record<
  string,
  { provider: string; credential: string; pending?: string }
> = {
  "melano-gmail-brief": {
    provider: "Gmail",
    credential: "Gmail account (OAuth)",
  },
  "melano-whatsapp-alertas": {
    provider: "Alertas críticas · WhatsApp + Email",
    credential: "Gmail account (OAuth) · WhatsApp Business Cloud pendiente",
    pending:
      "El canal Email está operativo. WhatsApp queda deshabilitado en n8n: falta la credencial de envío (WhatsApp Business Cloud) y el Phone Number ID.",
  },

  "melano-sheets-pipeline": {
    provider: "Google Sheets",
    credential: "Google Sheets account (OAuth)",
    pending: "Falta seleccionar la planilla y la hoja destino en n8n.",
  },
  "melano-openai-enriquecimiento": {
    provider: "OpenAI",
    credential: "n8n free OpenAI API credits (administrada)",
  },
  "command-center": {
    provider: "Command Center",
    credential: "Command Center Header Auth (Lovable)",
  },
};

function integrationState(rule: RuleLike) {
  if (rule.last_error) return "ERROR";
  if (!rule.n8n_webhook_url) return "SIN WEBHOOK";
  if (!rule.enabled) return "PAUSED";
  return "ACTIVE";
}

/**
 * Panel de integraciones: qué workflow de n8n usa qué credencial,
 * en qué estado está y cuándo corrió por última vez. Sólo datos reales.
 */
export function IntegracionesPanel({
  rules,
  runs,
}: {
  rules: RuleLike[];
  runs: RunLike[];
}) {
  const known = rules.flatMap((r) => {
    const meta = r.n8n_workflow ? CATALOG[r.n8n_workflow] : undefined;
    return meta ? [{ rule: r, meta }] : [];
  });

  return (
    <Panel title="Integraciones conectadas en n8n">
      <p className="text-sm text-muted-foreground">
        Cada integración muestra la credencial real usada en n8n, su estado y su última ejecución
        registrada. Las que figuran como pendientes todavía requieren configuración en n8n y no
        deben considerarse operativas.
      </p>

      {known.length === 0 ? (
        <div className="mt-3">
          <Empty text="Sin integraciones registradas todavía." />
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {known.map(({ rule: r, meta }) => {
            const lastRun = runs.find((x) => x.rule_id === r.id);
            const state = integrationState(r);
            return (
              <li key={r.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {meta.provider}
                    </p>
                  </div>
                  <StatusBadge status={state} />
                </div>

                <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="shrink-0">Credencial:</dt>
                    <dd className="truncate text-foreground">{meta.credential}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">Workflow:</dt>
                    <dd className="truncate">{r.n8n_workflow}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">Último run:</dt>
                    <dd>
                      {lastRun
                        ? `${fmtDate(lastRun.started_at)} · trace ${
                            lastRun.trace_id ? lastRun.trace_id.slice(0, 8) : "—"
                          }`
                        : fmtDate(r.last_run_at)}
                    </dd>
                  </div>
                </dl>

                {meta.pending ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Pendiente: {meta.pending}</p>
                ) : null}
                {r.last_error ? (
                  <p className="mt-2 line-clamp-2 text-[11px] text-destructive">{r.last_error}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
