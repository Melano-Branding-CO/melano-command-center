import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_agents",
  title: "Listar agentes",
  description: "Estado del comité ejecutivo digital: rol, estado, modo y último resultado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    const { data, error } = await db
      .from("agents")
      .select("code,name,role,status,execution_mode,last_run_at,last_result,last_error,enabled")
      .eq("organization_id", orgId)
      .order("sort_order");
    if (error) return errorResult(error.message);
    return textResult({ agentes: data ?? [] });
  },
});
