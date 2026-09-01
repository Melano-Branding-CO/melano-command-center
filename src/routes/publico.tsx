import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, CalendarClock, LineChart as LineChartIcon, ShieldCheck } from "lucide-react";
import { getPublicStats, type PublicStats } from "@/lib/public-stats.functions";

export const Route = createFileRoute("/publico")({
  head: () => ({
    meta: [
      { title: "MELANO INC — Datos operativos en vivo" },
      {
        name: "description",
        content:
          "Panel público de MELANO INC: tareas, decisiones, aprobaciones y leads de nuestro sistema autónomo, con datos reales y sin login.",
      },
      { property: "og:title", content: "MELANO INC — Datos operativos en vivo" },
      {
        property: "og:description",
        content: "AI. Automation. Impact. Métricas reales de nuestro sistema de operación autónoma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicPage,
});

const PALETTE = [
  "var(--primary)",
  "var(--chart-2, var(--muted-foreground))",
  "var(--success, var(--primary))",
  "var(--warning, var(--primary))",
  "var(--destructive)",
  "var(--muted-foreground)",
];

const PHASE_LABEL: Record<string, string> = {
  FASE_0_14: "Fase 0–14 días",
  FASE_15_45: "Fase 15–45 días",
  FASE_46_90: "Fase 46–90 días",
};

const SERVICES = [
  {
    icon: Bot,
    title: "Equipo ejecutivo de agentes IA",
    text: "Agentes especializados en revenue, marketing, operaciones, producto y calidad, con objetivos, límites y trazabilidad por ejecución.",
  },
  {
    icon: CalendarClock,
    title: "Automatización operativa",
    text: "Reuniones ejecutivas programadas, priorización diaria y flujos event-driven que convierten señales en tareas concretas.",
  },
  {
    icon: ShieldCheck,
    title: "Gobierno y aprobaciones",
    text: "Niveles de autonomía controlados: toda acción crítica requiere aprobación humana explícita y queda registrada.",
  },
  {
    icon: LineChartIcon,
    title: "Command Center a medida",
    text: "Implementamos el mismo sistema para tu empresa: base de datos, métricas verificadas, logs auditables y tableros ejecutivos.",
  },
];

function PublicPage() {
  const fetchStats = useServerFn(getPublicStats);
  const { data, isLoading, isError } = useQuery<PublicStats>({
    queryKey: ["public-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">MELANO INC</span>
          <Link
            to="/auth"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Acceso clientes
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="max-w-3xl">
          <p className="label-caps text-muted-foreground">AI. Automation. Impact.</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Operación autónoma con datos verificables
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            MELANO INC diseña y opera sistemas de IA que ejecutan trabajo real: priorizan, deciden,
            piden aprobación y registran cada paso. Estos son los indicadores agregados de nuestro
            propio Command Center, actualizados automáticamente.
          </p>
        </section>

        {isError ? (
          <p className="mt-10 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
            No pudimos cargar los indicadores en este momento.
          </p>
        ) : isLoading || !data ? (
          <p className="mt-10 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Cargando indicadores…
          </p>
        ) : (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Tareas ejecutadas" value={`${data.totals.tasksDone} / ${data.totals.tasks}`} />
              <Kpi label="Decisiones registradas" value={data.totals.decisions} />
              <Kpi
                label="Aprobaciones resueltas"
                value={`${data.totals.approvalsResolved} / ${data.totals.approvals}`}
              />
              <Kpi
                label="Ejecuciones de agentes"
                value={`${data.totals.agentRunsSuccess} / ${data.totals.agentRuns}`}
              />
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Tareas por estado">
                <BarBlock data={data.tasksByStatus} />
              </ChartCard>
              <ChartCard title="Decisiones por estado">
                <BarBlock data={data.decisionsByStatus} />
              </ChartCard>
              <ChartCard title="Aprobaciones por estado">
                <PieBlock data={data.approvalsByStatus} />
              </ChartCard>
              <ChartCard title="Leads por fase comercial">
                <PieBlock
                  data={data.leadsByPhase.map((d) => ({
                    ...d,
                    name: PHASE_LABEL[d.name] ?? d.name,
                  }))}
                />
              </ChartCard>
              <ChartCard title="Actividad de los últimos 14 días" className="lg:col-span-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.activityByDay}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="tareas" stroke="var(--primary)" dot={false} />
                      <Line
                        type="monotone"
                        dataKey="decisiones"
                        stroke="var(--muted-foreground)"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Datos agregados y anónimos del sistema de MELANO INC. Actualizado{" "}
              {new Date(data.updatedAt).toLocaleString("es-AR")}.
            </p>
          </>
        )}

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Qué hacemos por tu empresa
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-border bg-card p-5">
                <Icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-5">
            <p className="flex-1 text-sm text-muted-foreground">
              ¿Querés un Command Center autónomo para tu operación?
            </p>
            <a
              href="mailto:contacto@melanoinc.com"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Escribinos
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
          MELANO INC — AI. Automation. Impact.
        </div>
      </footer>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}>
      <h2 className="label-caps mb-3">{title}</h2>
      {children}
    </section>
  );
}

function NoData() {
  return (
    <p className="flex h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      SIN DATOS
    </p>
  );
}

function BarBlock({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <NoData />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" name="Cantidad" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieBlock({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <NoData />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
