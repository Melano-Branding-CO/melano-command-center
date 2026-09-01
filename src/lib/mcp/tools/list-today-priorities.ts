import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_today_priorities",
  title: "Prioridades de hoy",
  description: "Devuelve las prioridades del día (máximo 3) del Command Center de MELANO INC.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    const { data, error } = await db
      .from("tasks")
      .select("id,title,status,priority,why_now,next_action,success_metric,today_date")
      .eq("organization_id", orgId)
      .eq("is_today_priority", true)
      .order("priority")
      .limit(3);
    if (error) return errorResult(error.message);
    return textResult({ prioridades: data ?? [] });
  },
});
