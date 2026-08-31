import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — MELANO INC" },
      { name: "description", content: "Reglas programadas y event-driven con su última ejecución." },
      { property: "og:title", content: "Automations — MELANO INC" },
      { property: "og:description", content: "Ejecución automática del sistema MELANO INC." },
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
  schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
};

function AutomationsPage() {
  const { data: org } = useOrg();
  const { data: rules, isLoading } = useOrgRows<Rule>("automation_rules", org?.id, {
    order: "created_at",
  });

  return (
    <>
      <PageHeader title="Automations" subtitle="Nada es GREEN sin trigger, ejecución, log y resultado." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (rules ?? []).length === 0 ? (
        <Empty text="Sin automatizaciones configuradas." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(rules ?? []).map((r) => (
            <Panel
              key={r.id}
              title={r.name}
              action={<StatusBadge status={r.enabled ? "ACTIVE" : "PAUSED"} />}
            >
              <p className="text-sm text-muted-foreground">{r.description ?? "—"}</p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Schedule: {r.schedule ?? "—"} · Último run: {fmtDate(r.last_run_at)} ·{" "}
                {r.last_status ?? "SIN DATOS"}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
