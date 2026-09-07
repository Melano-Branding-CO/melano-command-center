import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAgents, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";
import { runCanonicalBoardNow } from "@/lib/canonical-runtime.functions";

type ConsoleLine = {
  id: number;
  kind: "command" | "info" | "success" | "error" | "muted";
  text: string;
};

type Approval = {
  id: string;
  action: string;
  risk: string | null;
};

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
};

type MeetingRun = {
  id: string;
  trace_id: string | null;
  status: string;
  created_at: string;
};

const HELP_LINES = [
  "help                 Lista comandos permitidos",
  "status               Estado general del runtime",
  "agents               Estado de agentes",
  "board | board run    Ejecuta WF-02 canónico",
  "tasks                Muestra 3 tareas prioritarias",
  "approvals            Aprobaciones pendientes",
  "trace                Último trace_id conocido",
  "pwd                   Ubicación lógica",
  "clear | cls           Limpia la consola",
];

function statusWord(agent: Agent) {
  return String(agent.status ?? "UNKNOWN").toUpperCase();
}

export function MiniCommandConsole() {
  const { data: org } = useOrg();
  const { data: agents } = useAgents(org?.id);
  const { data: approvals } = useOrgRows<Approval>("approvals", org?.id, {
    eq: { status: "PENDING" },
    order: "requested_at",
    limit: 5,
  });
  const { data: tasks } = useOrgRows<Task>("tasks", org?.id, {
    order: "priority",
    asc: true,
    limit: 3,
  });
  const { data: meetings } = useOrgRows<MeetingRun>("meeting_runs", org?.id, {
    order: "created_at",
    asc: false,
    limit: 1,
  });

  const runBoard = useServerFn(runCanonicalBoardNow);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: 1, kind: "success", text: "MELANO Command Console v1" },
    { id: 2, kind: "muted", text: "Shell seguro · escribí help para ver comandos" },
  ]);
  const nextId = useRef(3);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => `PS MELANO:\\${org?.name ? "command" : "session"}>`, [org?.name]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, lines]);

  function push(kind: ConsoleLine["kind"], text: string) {
    setLines((current) => [...current, { id: nextId.current++, kind, text }]);
  }

  function printMany(kind: ConsoleLine["kind"], values: string[]) {
    setLines((current) => [
      ...current,
      ...values.map((text) => ({ id: nextId.current++, kind, text })),
    ]);
  }

  async function execute(raw: string) {
    const command = raw.trim();
    if (!command) return;

    push("command", `${prompt} ${command}`);
    setHistory((current) => [...current.filter((item) => item !== command), command].slice(-30));
    setHistoryIndex(-1);

    const normalized = command.toLowerCase().replace(/\s+/g, " ");

    if (normalized === "clear" || normalized === "cls") {
      setLines([]);
      return;
    }

    if (normalized === "help" || normalized === "?") {
      printMany("info", HELP_LINES);
      return;
    }

    if (normalized === "pwd") {
      push("info", "MELANO:\\command");
      return;
    }

    if (normalized === "status") {
      const list = (agents ?? []) as Agent[];
      const active = list.filter((agent) => statusWord(agent) === "ACTIVE").length;
      const errors = list.filter((agent) => statusWord(agent) === "ERROR").length;
      printMany("info", [
        `tenant: ${org?.name ?? "sin contexto"}`,
        `agents: ${list.length} total · ${active} ACTIVE · ${errors} ERROR`,
        `approvals: ${(approvals ?? []).length} pendientes`,
        `runtime: ${errors === 0 && list.length > 0 ? "READY" : "ATTENTION"}`,
      ]);
      return;
    }

    if (normalized === "agents") {
      const list = (agents ?? []) as Agent[];
      if (list.length === 0) {
        push("muted", "Sin agentes cargados.");
        return;
      }
      printMany(
        "info",
        list.map((agent) => `${statusWord(agent).padEnd(8)} ${agent.name}`),
      );
      return;
    }

    if (normalized === "tasks") {
      if ((tasks ?? []).length === 0) {
        push("muted", "Sin tareas disponibles.");
        return;
      }
      printMany(
        "info",
        (tasks ?? []).map((task, index) => `${index + 1}. [${task.priority}] ${task.title} · ${task.status}`),
      );
      return;
    }

    if (normalized === "approvals") {
      if ((approvals ?? []).length === 0) {
        push("success", "Sin aprobaciones pendientes.");
        return;
      }
      printMany(
        "info",
        (approvals ?? []).map((approval) => `${approval.id.slice(0, 8)} · ${approval.action} · riesgo ${approval.risk ?? "—"}`),
      );
      return;
    }

    if (normalized === "trace") {
      const latest = meetings?.[0];
      if (!latest) {
        push("muted", "No hay meeting_run disponible.");
        return;
      }
      printMany("info", [
        `trace_id: ${latest.trace_id ?? "—"}`,
        `status: ${latest.status}`,
        `meeting_run: ${latest.id}`,
      ]);
      return;
    }

    if (["board", "board run", "run board", "wf-02"].includes(normalized)) {
      if (!org?.id) {
        push("error", "No hay tenant activo. No se ejecutó ninguna acción.");
        return;
      }
      if (busy) {
        push("muted", "Ya hay una ejecución solicitada desde esta consola.");
        return;
      }
      setBusy(true);
      push("muted", "Despachando Board canónico a n8n…");
      try {
        const result = await runBoard({ data: { tenantId: org.id } });
        push("success", `ACCEPTED · trace_id ${result.traceId}`);
        window.setTimeout(() => qc.invalidateQueries(), 2500);
      } catch (error) {
        push("error", error instanceof Error ? error.message : "Falló la ejecución del Board.");
      } finally {
        setBusy(false);
      }
      return;
    }

    push("error", `Comando no permitido: ${command}. Usá help.`);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(92vw,390px)] overflow-hidden rounded-lg border border-border bg-[#070a0d]/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] font-semibold tracking-wide text-foreground">MELANO TERMINAL</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">SAFE COMMAND MODE</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Minimizar consola"
            >
              _
            </button>
          </div>

          <div
            ref={scrollRef}
            className="h-52 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5"
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className={
                  line.kind === "error"
                    ? "text-red-400"
                    : line.kind === "success"
                      ? "text-emerald-400"
                      : line.kind === "muted"
                        ? "text-muted-foreground"
                        : line.kind === "command"
                          ? "text-foreground"
                          : "text-sky-300"
                }
              >
                {line.text}
              </div>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border px-3 py-2 font-mono text-[11px]"
            onSubmit={(event) => {
              event.preventDefault();
              const current = value;
              setValue("");
              void execute(current);
            }}
          >
            <span className="shrink-0 text-emerald-400">{prompt}</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (history.length === 0) return;
                  const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
                  setHistoryIndex(next);
                  setValue(history[next] ?? "");
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (history.length === 0 || historyIndex < 0) return;
                  const next = historyIndex + 1;
                  if (next >= history.length) {
                    setHistoryIndex(-1);
                    setValue("");
                    return;
                  }
                  setHistoryIndex(next);
                  setValue(history[next] ?? "");
                }
              }}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder={busy ? "ejecutando…" : "help"}
              aria-label="Comando"
            />
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md border border-border bg-[#070a0d]/95 px-3 py-2 font-mono text-[11px] font-semibold tracking-wide text-emerald-400 shadow-lg hover:border-emerald-500/40"
        aria-expanded={open}
      >
        &gt;_ TERMINAL
      </button>
    </div>
  );
}
