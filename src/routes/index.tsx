import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/melano";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MELANO INC — Autonomous Command Center" },
      {
        name: "description",
        content:
          "Command Center autónomo de MELANO INC: MELANIA como CEO digital, agentes ejecutivos, decisiones trazables y aprobaciones humanas.",
      },
      { property: "og:title", content: "MELANO INC — Autonomous Command Center" },
      {
        property: "og:description",
        content: "AI. Automation. Impact. Equipo ejecutivo digital con trazabilidad real.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    title: "MELANIA — CEO digital",
    body: "Consolida el comité, detecta contradicciones y fija el Top 3 del día con responsables y métricas.",
  },
  {
    title: "Agentes ejecutivos",
    body: "CRO, CMO, COO, CTO, CFO, PRODUCT, LUXIA, ALENYA, TITAN, NOTORIUS y QA Auditor con objetivo y loop propio.",
  },
  {
    title: "Autoridad humana",
    body: "Toda acción crítica queda en el Approval Center con evidencia, impacto y riesgo antes de ejecutarse.",
  },
  {
    title: "Trazabilidad total",
    body: "Cada ciclo deja decisiones, tareas, runs y logs con trace_id en la base de datos.",
  },
];

function Landing() {
  const { data: session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/command", replace: true });
  }, [session, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="label-caps">MELANO INC</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Autonomous Command Center
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Sistema operativo empresarial autónomo. Estado, memoria, decisiones, logs y métricas en
          una sola base de datos; MELANIA orquesta, los agentes ejecutan y Bruno autoriza lo
          crítico.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isLoading ? "Cargando…" : "Entrar al Command Center"}
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-16 text-xs text-muted-foreground">
          Ciclo autónomo: OBSERVE → ANALYZE → PRIORITIZE → DECIDE → ASSIGN → EXECUTE → VERIFY →
          LEARN
        </p>
      </div>
    </main>
  );
}
