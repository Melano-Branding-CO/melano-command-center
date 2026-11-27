export function assertOperationRole(role: string | null | undefined) {
  if (!role || !["CEO", "ADMIN", "OPERATOR"].includes(role)) {
    throw new Error("DENIED: sin permisos para operar esta organización");
  }
}

export function assertAgentScope(agent: { organization_id: string; enabled: boolean; status: string } | null, organizationId: string) {
  if (!agent || agent.organization_id !== organizationId) throw new Error("DENIED: agente fuera de la organización autorizada");
  if (!agent.enabled) throw new Error("BLOQUEO: agente pausado");
  if (agent.status === "RUNNING") throw new Error("BLOQUEO: agente ya en ejecución");
}

export async function checked<T extends { error: { message: string } | null }>(operation: PromiseLike<T>): Promise<T> {
  const result = await operation;
  if (result.error) throw new Error(`No se pudo persistir o leer la operación: ${result.error.message}`);
  return result;
}

export function aiConfiguration(hasCredential: boolean) {
  return {
    configured: hasCredential,
    verified: false as const,
    reason: hasCredential
      ? "Configuración presente; servicio y saldo no verificados."
      : "BLOQUEO: falta AI_GATEWAY_API_KEY o VERCEL_OIDC_TOKEN en el servidor; no se enviarán solicitudes de IA.",
  };
}

export function assertAiConfiguration(hasCredential: boolean) {
  if (!hasCredential) throw new Error(aiConfiguration(false).reason);
}

export function aiHttpError(status: number) {
  if (status === 401) return "BLOQUEO · HTTP 401: credencial de IA rechazada; revisar configuración. Sin reintento automático.";
  if (status === 402) return "BLOQUEO · HTTP 402: sin saldo de IA; requiere reposición por el responsable. Sin reintento automático.";
  if (status === 429) return "BLOQUEO · HTTP 429: límite de IA alcanzado; esperar antes de una nueva ejecución manual. Sin reintento automático.";
  return `BLOQUEO · HTTP ${status}: el servicio de IA rechazó la ejecución. Sin reintento automático.`;
}