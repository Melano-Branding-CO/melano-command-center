import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "latest_meeting_brief",
  title: "Último brief ejecutivo",
  description: "Devuelve el brief consolidado de la última reunión ejecutiva y sus intervenciones.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);
    const { data: meeting, error } = await db
      .from("executive_meetings")
      .select("id,title,status,trigger,started_at,finished_at,summary,executive_brief,trace_id")
      .eq("organization_id", orgId)
      .order("scheduled_for", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!meeting) return textResult({ reunion: null, mensaje: "SIN DATOS: no hay reuniones." });
    const { data: outputs } = await db
      .from("meeting_outputs")
      .select("situation,problems,opportunities,proposed_action")
      .eq("meeting_id", meeting.id)
      .limit(15);
    return textResult({ reunion: meeting, intervenciones: outputs ?? [] });
  },
});
