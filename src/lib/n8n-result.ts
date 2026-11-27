export type WorkflowOutcome = { state: "success" | "failed" | "pending"; detail: string };

/** HTTP acceptance alone does not prove that the workflow finished. */
export function workflowOutcome(result: {
  ok: boolean;
  status: number;
  body: string;
}): WorkflowOutcome {
  if (!result.ok)
    return {
      state: "failed",
      detail: `HTTP ${result.status || "sin respuesta"} · ${result.body}`.slice(0, 500),
    };
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(result.body);
  } catch {
    return {
      state: "pending",
      detail:
        "Solicitud recibida; n8n no devolvió evidencia del resultado final. No reintentar sin revisar la ejecución.",
    };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { state: "pending", detail: "Respuesta recibida sin un resultado final verificable." };
  }
  const status = String(body["status"] ?? "").toLowerCase();
  if (
    body["ok"] === false ||
    body["success"] === false ||
    body["error"] ||
    ["failed", "error", "cancelled", "canceled"].includes(status)
  ) {
    return {
      state: "failed",
      detail: "n8n informó un fallo en la ejecución; revisar el detalle en n8n.",
    };
  }
  const executionId = body["executionId"] ?? body["execution_id"];
  if (
    ["success", "completed"].includes(status) &&
    (typeof executionId === "string" || typeof executionId === "number")
  ) {
    return {
      state: "success",
      detail: `n8n confirmó ${status} · ejecución ${String(executionId).slice(0, 100)}`,
    };
  }
  return {
    state: "pending",
    detail: "n8n recibió la solicitud; falta confirmar el resultado final de la ejecución.",
  };
}
