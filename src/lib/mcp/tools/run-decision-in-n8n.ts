import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, resolveOrgId, supabaseForUser, textResult } from "../supabase";
import { dispatchN8n } from "../n8n";

export default defineTool({
  name: "run_decision_in_n8n",
  title: "Ejecutar decisión en n8n",
  description:
    "Ejecuta una decisión en el workflow de n8n activo. Si la decisión requiere aprobación y aún no fue aprobada, no ejecuta: sólo notifica a Bruno. Deja run + log auditables visibles en /today y /meetings.",
  inputSchema: {
    decision_id: z.string().uuid().describe("ID de la decisión."),
    note: z.string().trim().optional().describe("Contexto adicional para el workflow."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("No autenticado");
    const db = supabaseForUser(ctx);
    const orgId = await resolveOrgId(db);

    const { data: decision, error } = await db
      .from("decisions")
      .select(
        "id,title,description,status,priority,risk,expected_impact,confidence,requires_approval,meeting_id",
      )
      .eq("id", input.decision_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!decision) return errorResult("Decisión no encontrada en tu organización");

    const blocked = decision.requires_approval && decision.status !== "APPROVED";
    const event = blocked ? "n8n.decision.approval_required" : "n8n.decision.run";

    let approval: Record<string, unknown> | null = null;
    if (blocked) {
      const { data: rows } = await db
        .from("approvals")
        .select("id,action,status,risk,impact,reason")
        .eq("organization_id", orgId)
        .eq("decision_id", decision.id)
        .order("requested_at", { ascending: false })
        .limit(1);
      approval = rows?.[0] ?? null;
    }

    const res = await dispatchN8n(
      db,
      ctx.getUserId() ?? "mcp",
      orgId,
      event,
      { type: "decision", id: decision.id, meetingId: decision.meeting_id },
      {
        decision,
        approval,
        note: input.note ?? null,
        title: decision.title,
        notify: blocked ? "bruno" : null,
        stage: blocked ? "pending_approval" : "execute",
      },
    );

    if (!res.ok) return errorResult(`${res.error ?? "Error llamando a n8n"} (trace ${res.traceId ?? "—"})`);
    return textResult({
      decision: decision.title,
      ejecutada: !blocked,
      motivo: blocked ? "Requiere aprobación humana de Bruno; se envió el aviso a n8n." : null,
      workflow: res.rule,
      trace_id: res.traceId,
      respuesta: res.output.slice(0, 1000),
    });
  },
});
