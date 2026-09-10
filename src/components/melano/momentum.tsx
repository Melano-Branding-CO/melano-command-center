import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import { Panel } from "@/components/melano/shell";
import { useOrg, todayKey } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { cn } from "@/lib/utils";

/**
 * Momentum ejecutivo: puntaje, racha y rentabilidad calculados 100% con datos
 * persistidos. Nunca inventa cifras: si no hay registros, muestra SIN DATOS.
 */

type TaskRow = {
  id: string;
  status: string;
  is_today_priority: boolean;
  today_date: string | null;
};
type MeetingRow = { id: string; status: string; scheduled_for: string; started_at: string | null };
type DecisionRow = { id: string; status: string; created_at: string };
type ApprovalRow = { id: string; status: string; requested_at: string };
type AutomationRunRow = { id: string; status: string; started_at: string };
type ClientRow = { id: string; status: string; mrr: number | null };
type GoalRow = { id: string; year: number; mrr_target: number | null };

const DAY = 86_400_000;

function dayKey(iso: string, tz?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

function shiftKey(base: string, days: number) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function ratio(done: number, total: number) {
  return total > 0 ? done / total : null;
}

export function MomentumPanel({ className }: { className?: string }) {
  const { data: org } = useOrg();
  const tz = org?.timezone ?? undefined;
  const today = todayKey(tz);
  const since = new Date(Date.now() - 7 * DAY).getTime();

  const { data: tasks } = useOrgRows<TaskRow>("tasks", org?.id, {
    order: "updated_at",
    limit: 500,
  });
  const { data: meetings } = useOrgRows<MeetingRow>("executive_meetings", org?.id, {
    order: "scheduled_for",
    limit: 120,
  });
  const { data: decisions } = useOrgRows<DecisionRow>("decisions", org?.id, {
    order: "created_at",
    limit: 300,
  });
  const { data: approvals } = useOrgRows<ApprovalRow>("approvals", org?.id, {
    order: "requested_at",
    limit: 200,
  });
  const { data: runs } = useOrgRows<AutomationRunRow>("automation_runs", org?.id, {
    order: "started_at",
    limit: 300,
  });
  const { data: clients } = useOrgRows<ClientRow>("clients", org?.id, {
    order: "created_at",
    limit: 300,
  });
  const { data: goals } = useOrgRows<GoalRow>("annual_goals", org?.id, { order: "year", limit: 5 });

  const m = useMemo(() => {
    const todayTasks = (tasks ?? []).filter((t) => t.is_today_priority && t.today_date === today);
    const todayDone = todayTasks.filter((t) => t.status === "DONE").length;

    const recentDecisions = (decisions ?? []).filter(
      (d) => new Date(d.created_at).getTime() >= since,
    );
    const decisionsClosed = recentDecisions.filter((d) =>
      ["APPROVED", "COMPLETED", "REJECTED"].includes(d.status),
    ).length;

    const pendingOld = (approvals ?? []).filter(
      (a) => a.status === "PENDING" && Date.now() - new Date(a.requested_at).getTime() > DAY,
    ).length;
    const pendingNow = (approvals ?? []).filter((a) => a.status === "PENDING").length;

    const recentRuns = (runs ?? []).filter((r) => new Date(r.started_at).getTime() >= since);
    const runsOk = recentRuns.filter((r) => r.status === "SUCCESS").length;

    // Racha: días consecutivos con al menos una reunión ejecutiva completada.
    const meetingDays = new Set(
      (meetings ?? [])
        .filter((x) => x.status === "COMPLETED")
        .map((x) => dayKey(x.started_at ?? x.scheduled_for, tz)),
    );
    let streak = 0;
    let cursor = meetingDays.has(today) ? today : shiftKey(today, 1);
    while (meetingDays.has(cursor) && streak < 400) {
      streak += 1;
      cursor = shiftKey(cursor, 1);
    }

    const activeClients = (clients ?? []).filter((c) => c.status === "ACTIVO");
    const mrr = activeClients.reduce((sum, c) => sum + Number(c.mrr ?? 0), 0);
    const goal = (goals ?? []).find((g) => g.year === new Date().getFullYear()) ?? (goals ?? [])[0];
    const mrrTarget = Number(goal?.mrr_target ?? 0);

    const parts = [
      { key: "Cierre del día", weight: 30, value: ratio(todayDone, todayTasks.length) },
      {
        key: "Decisiones resueltas (7d)",
        weight: 20,
        value: ratio(decisionsClosed, recentDecisions.length),
      },
      {
        key: "Aprobaciones al día",
        weight: 15,
        value: pendingNow === 0 ? 1 : pendingOld > 0 ? 0 : 0.5,
      },
      {
        key: "Fiabilidad automatización (7d)",
        weight: 25,
        value: ratio(runsOk, recentRuns.length),
      },
      { key: "Ritmo de reunión", weight: 10, value: meetingDays.has(today) ? 1 : 0 },
    ];
    const measured = parts.filter((p) => p.value !== null);
    const weight = measured.reduce((s, p) => s + p.weight, 0);
    const score =
      weight > 0
        ? Math.round(
            (measured.reduce((s, p) => s + p.weight * (p.value as number), 0) / weight) * 100,
          )
        : null;

    return {
      todayTasks: todayTasks.length,
      todayDone,
      streak,
      parts,
      score,
      mrr,
      mrrTarget,
      pendingNow,
    };
  }, [tasks, meetings, decisions, approvals, runs, clients, goals, today, tz, since]);

  const perfect = m.todayTasks > 0 && m.todayDone === m.todayTasks;

  return (
    <Panel
      title="Momentum ejecutivo"
      className={cn("melano-rise", className)}
      action={
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-success">
          <span className="melano-live inline-block size-1.5 rounded-full bg-success" />
          En vivo
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <ScoreDial value={m.score} />
            <div className="space-y-2">
              <Chip
                icon={Flame}
                tone={m.streak > 0 ? "warning" : "muted"}
                label={
                  m.streak > 0
                    ? `Racha ${m.streak} día${m.streak === 1 ? "" : "s"}`
                    : "Sin racha activa"
                }
              />
              <Chip
                icon={Trophy}
                tone={perfect ? "success" : "muted"}
                label={
                  m.todayTasks === 0
                    ? "Top 3 sin generar"
                    : `Top 3 · ${m.todayDone}/${m.todayTasks} cerradas`
                }
                shine={perfect}
              />
              <Chip
                icon={Zap}
                tone={m.pendingNow > 0 ? "warning" : "success"}
                label={
                  m.pendingNow > 0
                    ? `${m.pendingNow} aprobación(es) pendientes`
                    : "Aprobaciones al día"
                }
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="label-caps">Rentabilidad · MRR activo</span>
              <span className="font-semibold text-foreground">
                {m.mrr > 0 ? `USD ${m.mrr.toLocaleString("es-AR")}` : "SIN DATOS"}
              </span>
            </div>
            <Bar
              value={m.mrrTarget > 0 ? Math.min(1, m.mrr / m.mrrTarget) : 0}
              tone={m.mrr > 0 ? "success" : "muted"}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {m.mrrTarget > 0
                ? `Meta anual USD ${m.mrrTarget.toLocaleString("es-AR")} · ${
                    m.mrr > 0 ? Math.round((m.mrr / m.mrrTarget) * 100) : 0
                  }% alcanzado`
                : "Sin meta anual cargada. El sistema no estima ingresos que no estén registrados."}
            </p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {m.parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.key}</span>
                <span className="font-semibold text-foreground">
                  {p.value === null ? "SIN DATOS" : `${Math.round(p.value * 100)}%`}
                </span>
              </div>
              <Bar
                value={p.value ?? 0}
                tone={
                  p.value === null
                    ? "muted"
                    : p.value >= 0.8
                      ? "success"
                      : p.value >= 0.4
                        ? "warning"
                        : "danger"
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

const toneBar: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/30",
};

function Bar({ value, tone }: { value: number; tone: keyof typeof toneBar | string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("melano-bar h-full rounded-full", toneBar[tone] ?? toneBar["muted"])}
        style={{ width: `${w * 100}%` }}
      />
    </div>
  );
}

function ScoreDial({ value }: { value: number | null }) {
  const target = value ?? 0;
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);

  const color =
    value === null
      ? "var(--color-muted-foreground)"
      : target >= 80
        ? "var(--color-success)"
        : target >= 50
          ? "var(--color-warning)"
          : "var(--color-destructive)";

  return (
    <div
      className="relative grid size-28 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${shown * 3.6}deg, var(--color-muted) 0deg)`,
      }}
      role="img"
      aria-label={value === null ? "Score ejecutivo sin datos" : `Score ejecutivo ${target} de 100`}
    >
      <div className="grid size-[5.5rem] place-items-center rounded-full bg-card text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {value === null ? "—" : shown}
          </p>
          <p className="label-caps">Score</p>
        </div>
      </div>
    </div>
  );
}

const toneChip: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  muted: "border-border bg-muted text-muted-foreground",
};

function Chip({
  icon: Icon,
  label,
  tone,
  shine,
}: {
  icon: typeof Target;
  label: string;
  tone: keyof typeof toneChip | string;
  shine?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold",
        toneChip[tone] ?? toneChip["muted"],
        shine && "melano-sheen",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export { TrendingUp };
