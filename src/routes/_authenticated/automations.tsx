import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fmtDate, useOrg, useMyRole } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import {
  getN8nStatus,
  runAutomationRule,
  setAutomationWorkflow,
  toggleAutomationRule,
} from "@/lib/automations.functions";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — MELANO INC" },
      { name: "description", content: "Automatizaciones conectadas a n8n con ejecución, logs y resultado real." },
      { property: "og:title", content: "Automations — MELANO INC" },
      { property: "og:description", content: "Ejecución automática real del sistema MELANO INC." },
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
  trigger: string;
  action: string;
  status: string;
  schedule_expression: string | null;
  last_run_at: string | null;
  last_result: string | null;
  last_error: string | null;
  n8n_workflow: string | null;
  n8n_webhook_url: string | null;
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

const OPERATOR_ROLES = ["CEO", "ADMIN", "OPERATOR"];

function AutomationsPage() {
  const qc = useQueryClient();
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const canOperate = OPERATOR_ROLES.includes(role ?? "");

  useRealtime(["automation_rules", "automation_runs"]);

  const { data: rules, isLoading } = useOrgRows<Rule>("automation_rules", org?.id, { order: "created_at", asc: true });
  const { data: runs } = useOrgRows<Run>("automation_runs", org?.id, { order: "started_at", limit: 60 });

  const statusFn = useServerFn(getN8nStatus);
  const { data: n8n } = useQuery({ queryKey: ["n8n-status"], queryFn: () => statusFn({}) });

  const runFn = useServerFn(runAutomationRule);
  const toggleFn = useServerFn(toggleAutomationRule);
  const saveFn = useServerFn(setAutomationWorkflow);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["automation_rules"] });
    qc.invalidateQueries({ queryKey: ["automation_runs"] });
  };

  const run = useMutation({
    mutationFn: (vars: { ruleId: string; test: boolean }) =>
      runFn({ data: { organizationId: org!.id, ruleId: vars.ruleId, test: vars.test } }),
    onSuccess: (r) => {
      invalidate();
      if (r.ok) toast.success(`Ejecutado en n8n · HTTP ${r.status}`);
      else toast.error(`n8n respondió con error: ${r.detail}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { ruleId: string; enabled: boolean }) =>
      toggleFn({ data: { organizationId: org!.id, ...vars } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (vars: { ruleId: string; workflow: string }) =>
      saveFn({ data: { organizationId: org!.id, ...vars } }),
    onSuccess: () => {
      invalidate();
      toast.success("Workflow guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Conectadas a n8n. Nada es GREEN sin trigger, ejecución, log y resultado."
      />

      <Panel
        title="Conexión n8n"
        action={<StatusBadge status={n8n?.configured ? "ACTIVE" : "PAUSED"} />}
      >
        {n8n?.configured ? (
          <p className="text-sm text-muted-foreground">
            Instancia: <span className="text-foreground">{n8n.host}</span> · El token de webhook se guarda en el
            backend y nunca se expone en la interfaz.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Falta configurar la conexión con n8n en el backend. Sin eso, ninguna automatización puede ejecutarse.
          </p>
        )}
      </Panel>

      <div className="mt-4">
        {isLoading ? (
          <Empty text="Cargando…" />
        ) : (rules ?? []).length === 0 ? (
          <Empty text="Sin automatizaciones configuradas." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(rules ?? []).map((r) => (
              <RuleCard
                key={r.id}
                rule={r}
                runs={(runs ?? []).filter((x) => x.rule_id === r.id).slice(0, 3)}
                canOperate={canOperate && !!n8n?.configured}
                busy={run.isPending || toggle.isPending || save.isPending}
                onRun={(test) => run.mutate({ ruleId: r.id, test })}
                onToggle={(enabled) => toggle.mutate({ ruleId: r.id, enabled })}
                onSave={(workflow) => save.mutate({ ruleId: r.id, workflow })}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RuleCard({
  rule,
  runs,
  canOperate,
  busy,
  onRun,
  onToggle,
  onSave,
}: {
  rule: Rule;
  runs: Run[];
  canOperate: boolean;
  busy: boolean;
  onRun: (test: boolean) => void;
  onToggle: (enabled: boolean) => void;
  onSave: (workflow: string) => void;
}) {
  const fallbackSlug = rule.n8n_webhook_url?.split("?")[0]?.replace(/\/+$/, "").split("/").pop() ?? "";
  const [workflow, setWorkflow] = useState(rule.n8n_workflow ?? fallbackSlug);
  const configured = !!(rule.n8n_workflow ?? fallbackSlug);

  return (
    <Panel
      title={rule.name}
      action={
        <div className="flex items-center gap-2">
          <StatusBadge status={rule.enabled ? "ACTIVE" : "PAUSED"} />
          <Switch
            checked={rule.enabled}
            disabled={!canOperate || busy}
            onCheckedChange={(v) => onToggle(v)}
            aria-label={`Activar ${rule.name}`}
          />
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{rule.description ?? "—"}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={workflow}
          onChange={(e) => setWorkflow(e.target.value)}
          placeholder="path del webhook en n8n"
          className="h-9 max-w-[240px]"
          disabled={!canOperate || busy}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!canOperate || busy || !workflow || workflow === (rule.n8n_workflow ?? fallbackSlug)}
          onClick={() => onSave(workflow)}
        >
          Guardar
        </Button>
        <Button size="sm" disabled={!canOperate || busy || !configured} onClick={() => onRun(false)}>
          Ejecutar
        </Button>
        <Button size="sm" variant="ghost" disabled={!canOperate || busy || !configured} onClick={() => onRun(true)}>
          Probar
        </Button>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Trigger: {rule.trigger} · Schedule: {rule.schedule_expression ?? "—"} · Último run: {fmtDate(rule.last_run_at)} ·{" "}
        {rule.status ?? "SIN DATOS"}
      </p>
      {rule.last_error ? (
        <p className="mt-1 text-[11px] text-destructive">Error: {rule.last_error}</p>
      ) : rule.last_result ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Resultado: {rule.last_result}</p>
      ) : null}

      {runs.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border/60 pt-2">
          {runs.map((x) => (
            <li key={x.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{fmtDate(x.started_at)}</span>
              <span className={x.status === "FAILED" ? "text-destructive" : ""}>{x.status}</span>
              <span className="truncate max-w-[45%] text-right">{x.error ?? x.output ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">Sin ejecuciones registradas.</p>
      )}
    </Panel>
  );
}
