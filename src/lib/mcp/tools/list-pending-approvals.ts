import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_pending_approvals",
  title: "Aprobaciones pendientes",
  description: "Lista las acciones críticas que esperan aprobación humana.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    const { data, error } = await db
      .from("approvals")
      .select("id,action,category,risk,impact,reason,status,created_at,trace_id")
      .eq("organization_id", orgId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return errorResult(error.message);
    return textResult({ aprobaciones_pendientes: data ?? [] });
  },
});
