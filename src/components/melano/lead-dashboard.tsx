import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { summarizeLeads, type LeadBucket, type SummaryLead } from "@/lib/lead-summary";

function Distribution({ title, rows, color, total }: {
  title: string; rows: LeadBucket[]; color: string; total: number;
}) {
  return (
    <figure className="min-w-0" aria-label={`Distribución por ${title.toLowerCase()}`}>
      <figcaption className="mb-3 text-sm font-semibold text-foreground">{title}</figcaption>
      <ChartContainer
        className="h-56 w-full aspect-auto"
        config={{ count: { label: "Leads", color } }}
      >
        <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 35, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={100} tickLine={false} axisLine={false}
            tickFormatter={(label: string) => label.length > 15 ? `${label.slice(0, 14)}…` : label} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="count" fill="var(--color-count)" maxBarSize={28} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" fill="var(--foreground)" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="mt-3 space-y-1.5 text-xs">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-muted-foreground">{row.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{row.count} · {Math.round(row.count / total * 100)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function LeadDashboard({ leads }: { leads: readonly SummaryLead[] }) {
  const summary = useMemo(() => summarizeLeads(leads), [leads]);
  if (leads.length === 0) return null;
  return (
    <section aria-label="Resumen de leads" className="mb-8 border-y border-border py-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Flujo de leads</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{leads.length} leads</span>
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <Distribution title="Fases" rows={summary.phases} color="var(--chart-5)" total={leads.length} />
        <Distribution title="Prioridad" rows={summary.priorities} color="var(--chart-3)" total={leads.length} />
        <div className="min-w-0">
          <Distribution title="Zona" rows={summary.zones} color="var(--chart-2)" total={leads.length} />
          {summary.allZones.length > 5 ? (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer text-foreground">Todas las zonas ({summary.allZones.length})</summary>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {summary.allZones.map((zone) => (
                  <li key={zone.label} className="flex justify-between gap-3">
                    <span className="break-words">{zone.label}</span>
                    <span className="tabular-nums">{zone.count}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}