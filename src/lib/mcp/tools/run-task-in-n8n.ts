import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";
import { dispatchN8n } from "../n8n";

export default defineTool({
  name: "run_task_in_n8n",
  title: "Ejecutar tarea en n8n",
  description:
    "Ejecuta una tarea del Command Center en el workflow de n8n activo. Actualiza el estado de la tarea y deja run + log auditables visibles en /today y /meetings.",
  inputSchema: {
    task_id: z.string().uuid().describe("ID de la tarea a ejecutar."),
    note: z.string().trim().optional().describe("Nota o instrucción extra para el workflow."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);

    const { data: task, error } = await db
      .from("tasks")
      .select(
        "id,title,description,status,priority,why_now,next_action,success_metric,assigned_agent,meeting_id,deadline",
      )
      .eq("id", input.task_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!task) return errorResult("Tarea no encontrada en tu organización");

    await db.from("tasks").update({ status: "RUNNING" }).eq("id", task.id);

    const res = await dispatchN8n(
      db,
      ctx.getUserId() ?? "mcp",
      orgId,
      "n8n.task.run",
      { type: "task", id: task.id, meetingId: task.meeting_id },
      { task, note: input.note ?? null, title: task.title },
    );

    await db
      .from("tasks")
      .update({
        status: res.ok ? "REVIEW" : res.status === "SKIPPED" ? "READY" : "FAILED",
        ...(res.traceId ? { trace_id: res.traceId } : {}),
      })
      .eq("id", task.id);

    if (!res.ok) return errorResult(`${res.error ?? "Error llamando a n8n"} (trace ${res.traceId ?? "—"})`);
    return textResult({
      tarea: task.title,
      estado: "REVIEW",
      workflow: res.rule,
      trace_id: res.traceId,
      respuesta: res.output.slice(0, 1000),
    });
  },
});
