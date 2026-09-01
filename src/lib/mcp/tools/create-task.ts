import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Crear tarea",
  description: "Crea una tarea operativa en el Command Center, con prioridad y métrica de éxito.",
  inputSchema: {
    title: z.string().trim().min(3).describe("Título de la tarea."),
    description: z.string().trim().optional().describe("Detalle o contexto de la tarea."),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional().describe("Prioridad (default P2)."),
    success_metric: z.string().trim().optional().describe("Métrica verificable de cierre."),
    next_action: z.string().trim().optional().describe("Próxima acción concreta."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    const { data, error } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "P2",
        status: "READY",
        execution_mode: "ASSISTED",
        success_metric: input.success_metric ?? null,
        next_action: input.next_action ?? null,
      })
      .select("id,title,status,priority")
      .single();
    if (error) return errorResult(error.message);
    return textResult({ tarea: data });
  },
});
