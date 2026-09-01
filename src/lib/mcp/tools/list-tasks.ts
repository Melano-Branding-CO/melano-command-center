import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tareas",
  description: "Lista tareas operativas de la organización, opcionalmente filtradas por estado.",
  inputSchema: {
    status: z
      .enum(["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "DONE", "FAILED"])
      .optional()
      .describe("Filtrar por estado de la tarea."),
    limit: z.number().int().min(1).max(50).optional().describe("Cantidad máxima (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    let query = db
      .from("tasks")
      .select("id,title,status,priority,deadline,success_metric,next_action,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ tareas: data ?? [] });
  },
});
