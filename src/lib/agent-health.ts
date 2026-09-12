export type AgentHealthInput = {
  enabled: boolean;
  status: string;
  last_run_at: string | null;
  last_error: string | null;
};

export type AgentRunHealthInput = {
  status: string;
  started_at: string | null;
  finished_at?: string | null;
  error?: string | null;
  trace_id?: string | null;
};

export type AgentHealth = {
  status: "GREEN" | "YELLOW" | "RED";
  reason: string;
  observedAt: string | null;
  traceId: string | null;
};

/**
 * Estado operativo derivado exclusivamente de evidencia persistida.
 * ACTIVE expresa configuración; GREEN exige una ejecución finalizada con éxito,
 * señal reciente y ninguna evidencia de error. El esquema actual no persiste un
 * heartbeat/error_count independiente, por lo que no se puede declarar GREEN.
 */
export function getAgentHealth(
  agent: AgentHealthInput,
  runs: AgentRunHealthInput[],
  now = Date.now(),
): AgentHealth {
  const latest = runs[0] ?? null;
  const observedAt = latest?.finished_at ?? latest?.started_at ?? agent.last_run_at;
  const traceId = latest?.trace_id ?? null;

  if (!agent.enabled || agent.status === "PAUSED") {
    return { status: "YELLOW", reason: "Agente pausado o deshabilitado.", observedAt, traceId };
  }
  if (agent.status === "ERROR" || agent.last_error || latest?.status === "FAILED" || latest?.error) {
    return { status: "RED", reason: agent.last_error ?? latest?.error ?? "Última ejecución fallida.", observedAt, traceId };
  }
  if (agent.status !== "ACTIVE") {
    return { status: "YELLOW", reason: `Estado operativo: ${agent.status}.`, observedAt, traceId };
  }
  if (!latest || latest.status !== "SUCCESS" || !latest.finished_at) {
    return { status: "YELLOW", reason: "Falta una última ejecución completada con éxito.", observedAt, traceId };
  }
  if (!observedAt || now - new Date(observedAt).getTime() > 15 * 60_000) {
    return { status: "YELLOW", reason: "La última señal operativa tiene más de 15 minutos.", observedAt, traceId };
  }

  return {
    status: "YELLOW",
    reason: "La fuente actual no registra heartbeat ni error_count; GREEN queda bloqueado hasta verificar ambas señales.",
    observedAt,
    traceId,
  };
}
