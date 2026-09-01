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
import { ArrowUpRight } from "lucide-react";
import { getPublicStats, type PublicStats } from "@/lib/public-stats.functions";

export const Route = createFileRoute("/publico")({
  head: () => ({
    meta: [
      { title: "MELANO INC — IA, automatización y datos en vivo" },
      {
        name: "description",
        content:
          "Convertimos operaciones fragmentadas en sistemas inteligentes. IA aplicada, automatización conectada y real estate tech, con indicadores operativos reales y públicos.",
      },
      { property: "og:title", content: "MELANO INC — AI. Automation. Impact." },
      {
        property: "og:description",
        content:
          "Arquitectura de IA, automatización y revenue systems con trazabilidad. Mirá los datos operativos reales de nuestro Command Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicPage,
});

const PALETTE = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

const PHASE_LABEL: Record<string, string> = {
  FASE_0_14: "Fase 0–14 días",
  FASE_15_45: "Fase 15–45 días",
  FASE_46_90: "Fase 46–90 días",
};

const CAPABILITIES = [
  {
    n: "01",
    kicker: "IA APLICADA",
    title: "Agentes con función definida",
    text: "Asistentes para atender, calificar, analizar, priorizar y ejecutar dentro de límites operativos claros.",
  },
  {
    n: "02",
    kicker: "AUTOMATIZACIÓN",
    title: "Flujos conectados",
    text: "WhatsApp, CRM, formularios, agenda, email y datos unidos para reducir tareas manuales y pérdida de contexto.",
  },
  {
    n: "03",
    kicker: "REVENUE SYSTEMS",
    title: "Seguimiento medible",
    text: "Captación, scoring, próximo paso, responsables y outcomes para transformar demanda en pipeline accionable.",
  },
  {
    n: "04",
    kicker: "REAL ESTATE TECH",
    title: "Infraestructura inmobiliaria",
    text: "Captación, propiedades, leads, seguimiento, postventa e inteligencia comercial en una arquitectura lista para operar.",
  },
  {
    n: "05",
    kicker: "SOFTWARE & SAAS",
    title: "Activos digitales escalables",
    text: "MVP, plataformas y productos recurrentes diseñados para validar primero y automatizar después.",
  },
  {
    n: "06",
    kicker: "DATA & CONTROL",
    title: "Decisiones con evidencia",
    text: "Dashboards, alertas, trazabilidad y métricas para entender qué funciona, qué está bloqueado y qué hacer después.",
  },
];

const PILLARS = [
  {
    layer: "DECISION & ORCHESTRATION LAYER",
    name: "MELANIA",
    text: "Capa de inteligencia comercial y orquestación que conecta contexto, eventos, decisiones, automatizaciones y resultados.",
    href: null as string | null,
    cta: null as string | null,
  },
  {
    layer: "PRIORIDAD COMERCIAL · REAL ESTATE SAAS",
    name: "LUXIA",
    text: "Revenue Operating System para inmobiliarias: centraliza leads, prioriza oportunidades, recomienda el próximo paso y registra resultados.",
    href: "https://luxia.melanoinc.com/",
    cta: "Ir a LUXIA",
  },
  {
    layer: "FINANCIAL ANALYTICS",
    name: "TITAN",
    text: "Analítica, monitoreo y automatización financiera con controles explícitos antes de cualquier ejecución sensible.",
    href: null,
    cta: null,
  },
  {
    layer: "TOKENIZATION & RWA",
    name: "NOTORIUS",
    text: "Arquitectura para tokenización de activos y smart contracts, separando prototipo, testnet y producción.",
    href: null,
    cta: null,
  },
];

const LUXIA_FLOW = [
  "Captación desde web, campañas, portales o WhatsApp",
  "Calificación, prioridad y contexto comercial",
  "Next Best Action + responsable + seguimiento",
  "Visita, negociación, cierre o pérdida registrada",
  "Outcome para aprender qué convierte",
];

const METHOD = [
  { n: "01", title: "Diagnóstico", text: "Proceso, cuello de botella, datos, herramientas y criterio de éxito." },
  { n: "02", title: "Validación", text: "Hipótesis concreta, flujo mínimo y una métrica que permita decidir." },
  { n: "03", title: "Implementación", text: "Software, automatización, integraciones, permisos y QA funcional." },
  { n: "04", title: "Escala", text: "Medición, aprendizaje, estandarización y reducción del trabajo manual." },
];

const PRINCIPLES = [
  "Contexto y datos antes de la acción.",
  "Permisos y límites explícitos.",
  "Trazabilidad de decisión, acción y outcome.",
  "Arquitectura modular preparada para escalar.",
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
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold tracking-[0.2em] text-foreground">MELANO INC</span>
          <nav className="hidden items-center gap-7 text-xs text-muted-foreground md:flex">
            <a href="#capacidades" className="transition-colors hover:text-foreground">Capacidades</a>
            <a href="#ecosistema" className="transition-colors hover:text-foreground">Ecosistema</a>
            <a href="#datos" className="transition-colors hover:text-foreground">Datos en vivo</a>
            <a href="#metodo" className="transition-colors hover:text-foreground">Método</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              Acceso clientes
            </Link>
            <a
              href="#contacto"
              className="hidden rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:block"
            >
              Solicitar diagnóstico
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <p className="text-[11px] tracking-[0.35em] text-muted-foreground">AI · AUTOMATION · IMPACT</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            Convertimos operaciones fragmentadas en{" "}
            <span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
              sistemas inteligentes
            </span>
            .
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            MELANO INC diseña inteligencia artificial, automatización y software aplicado a ventas,
            operaciones y real estate. Menos tareas aisladas. Más control, trazabilidad y capacidad
            de escalar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contacto"
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Solicitar diagnóstico
            </a>
            <a
              href="https://luxia.melanoinc.com/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-1.5 rounded-full border border-border px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/60"
            >
              Conocer LUXIA
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted-foreground">
            {["IA aplicada a procesos reales", "Automatización conectada", "Revenue & Real Estate Tech"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1.5 rotate-45 bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CAPACIDADES */}
      <section id="capacidades" className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead
          kicker="ESTRATEGIA · TECNOLOGÍA · EJECUCIÓN"
          title="De procesos dispersos a una operación conectada."
          text="No vendemos herramientas aisladas. Diseñamos la arquitectura, conectamos los canales y dejamos trazabilidad para que ventas, atención y operaciones funcionen como un sistema."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <article key={c.n} className="group bg-card p-7 transition-colors hover:bg-accent">
              <p className="text-[10px] tracking-[0.25em] text-muted-foreground">
                {c.n} / {c.kicker}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{c.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              <div className="mt-5 h-px w-10 bg-primary transition-all duration-300 group-hover:w-20" />
            </article>
          ))}
        </div>
      </section>

      {/* ECOSISTEMA */}
      <section id="ecosistema" className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead
            kicker="ECOSISTEMA"
            title="Cuatro pilares. Una arquitectura."
            text="El ecosistema MELANO INC se organiza alrededor de productos y capas con objetivos distintos. Los agentes especializados funcionan como módulos internos, no como marcas que compiten entre sí."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {PILLARS.map((p) => (
              <article
                key={p.name}
                className="rounded-xl border border-border bg-card p-7 transition-colors hover:border-primary/40"
              >
                <p className="text-[10px] tracking-[0.25em] text-muted-foreground">{p.layer}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{p.name}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                {p.href ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {p.cta} <ArrowUpRight className="size-3.5" />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* LUXIA */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHead
              kicker="PRODUCTO PRIORITARIO"
              title="LUXIA convierte seguimiento en revenue intelligence."
              text="Para real estate, el problema no es sólo captar más leads: es evitar que cada consulta quede aislada en WhatsApp, portales, formularios o planillas. LUXIA unifica ese recorrido y deja cada oportunidad con contexto, prioridad y próximo paso."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://luxia.melanoinc.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Explorar LUXIA
              </a>
              <a
                href="#contacto"
                className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition-colors hover:border-primary/60"
              >
                Pedir diagnóstico inmobiliario
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-7">
            <h3 className="label-caps">Del lead al resultado</h3>
            <ol className="mt-5 space-y-4">
              {LUXIA_FLOW.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-sm text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* DATOS EN VIVO */}
      <section id="datos" className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead
            kicker="DATA & CONTROL"
            title="Nuestra propia operación, en datos."
            text="Estos indicadores salen del Command Center autónomo que opera MELANO INC. Son conteos agregados y anónimos: tareas, decisiones, aprobaciones y leads reales, sin exponer información de clientes."
          />

          {isError ? (
            <p className="mt-10 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
              No pudimos cargar los indicadores en este momento.
            </p>
          ) : isLoading || !data ? (
            <p className="mt-10 rounded-xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
              Cargando indicadores…
            </p>
          ) : (
            <>
              <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Tareas ejecutadas" value={`${data.totals.tasksDone} / ${data.totals.tasks}`} />
                <Kpi label="Decisiones registradas" value={data.totals.decisions} />
                <Kpi
                  label="Aprobaciones resueltas"
                  value={`${data.totals.approvalsResolved} / ${data.totals.approvals}`}
                />
                <Kpi
                  label="Clientes en seguimiento LUXIA"
                  value={`${data.totals.clientsActive} / ${data.totals.clients}`}
                />
                <Kpi
                  label="Ejecuciones de agentes"
                  value={`${data.totals.agentRunsSuccess} / ${data.totals.agentRuns}`}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                    data={data.leadsByPhase.map((d) => ({ ...d, name: PHASE_LABEL[d.name] ?? d.name }))}
                  />
                </ChartCard>
                <ChartCard title="Clientes por etapa LUXIA">
                  <PieBlock
                    data={data.clientsByStage.map((d) => ({
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
                        <Tooltip contentStyle={TOOLTIP} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="tareas" stroke="var(--primary)" strokeWidth={2} dot={false} />
                        <Line
                          type="monotone"
                          dataKey="decisiones"
                          stroke="var(--muted-foreground)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Datos agregados y anónimos · actualizado {new Date(data.updatedAt).toLocaleString("es-AR")}
              </p>
            </>
          )}
        </div>
      </section>

      {/* INNOVACIÓN + MÉTODO */}
      <section id="metodo" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHead
              kicker="INNOVACIÓN APLICADA"
              title="La IA tiene que operar sobre procesos, no quedar en una conversación."
              text="Diseñamos agentes y automatizaciones conectados a datos, reglas y objetivos de negocio. La autonomía se habilita sólo cuando existen permisos, trazabilidad y un criterio claro de éxito."
            />
            <ul className="mt-8 space-y-3">
              {PRINCIPLES.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 rotate-45 shrink-0 bg-primary" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Vender. Validar. Construir. Escalar.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              La implementación se ordena para reducir riesgo técnico y comercial. Primero se prueba
              el problema y el resultado; después se automatiza lo que ya demostró valor.
            </p>
            <div className="mt-7 space-y-px overflow-hidden rounded-xl border border-border bg-border">
              {METHOD.map((m) => (
                <div key={m.n} className="flex gap-5 bg-card p-5">
                  <span className="text-sm font-semibold text-primary">{m.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LIDERAZGO */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-24 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-muted-foreground">LIDERAZGO</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Bruno Melano</p>
            <p className="text-sm text-muted-foreground">CEO &amp; Founder</p>
            <a
              href="https://brunomelano.com/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Perfil del CEO <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Estrategia tecnológica con foco en ejecución.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Bruno Melano lidera MELANO INC en la intersección entre inteligencia artificial,
              automatización, sistemas comerciales y real estate tech.
            </p>
            <blockquote className="mt-6 border-l-2 border-primary pl-5 text-base italic text-foreground">
              “Construimos sistemas que convierten información dispersa en decisiones y acciones
              medibles.”
            </blockquote>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="mx-auto max-w-6xl px-5 py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
          />
          <div className="relative max-w-2xl">
            <p className="text-[10px] tracking-[0.25em] text-muted-foreground">PRÓXIMO PASO</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Encontrá el cuello de botella antes de sumar otra herramienta.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Contanos qué proceso querés mejorar. El diagnóstico identifica: problema prioritario ·
              flujo actual · oportunidad de automatización · próximo paso recomendado.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="mailto:contacto@melanoinc.com"
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Solicitar diagnóstico
              </a>
              <a
                href="mailto:contacto@melanoinc.com"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                contacto@melanoinc.com
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
          <span>MELANO INC — AI. Automation. Impact.</span>
          <div className="flex gap-5">
            <a href="https://melanoinc.com/privacidad/" target="_blank" rel="noreferrer" className="hover:text-foreground">
              Política de Privacidad
            </a>
            <Link to="/auth" className="hover:text-foreground">
              Acceso clientes
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const TOOLTIP = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function SectionHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[10px] tracking-[0.25em] text-muted-foreground">{kicker}</p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{text}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card p-6">
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
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
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <h3 className="label-caps mb-4">{title}</h3>
      {children}
    </section>
  );
}

function NoData() {
  return (
    <p className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
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
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={TOOLTIP} />
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
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} stroke="var(--card)">
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
