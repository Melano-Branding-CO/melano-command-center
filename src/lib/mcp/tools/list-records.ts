import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireOrganization } from "../supabase";

export default defineTool({
  name: "list_operational_records",
  title: "Consultar registros operativos",
  description: "Consulta hasta 50 tareas, decisiones, aprobaciones, leads o estados de agentes de una organización autorizada; no realiza cambios.",
  inputSchema: {
    organization_id: z.string().uuid().describe("Identificador obtenido con list_organizations."),
    kind: z.enum(["tasks", "decisions", "approvals", "leads", "agents"]).describe("Tipo de registros a consultar."),
    limit: z.number().int().min(1).max(50).default(20).describe("Cantidad máxima de registros, entre 1 y 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organization_id, kind, limit }, ctx) => {
    const db = await requireOrganization(ctx, organization_id);
    const query = kind === "tasks" ? db.from("tasks").select("id,title,status,priority,phase:execution_mode")
      : kind === "decisions" ? db.from("decisions").select("id,title,status,priority,requires_approval")
      : kind === "approvals" ? db.from("approvals").select("id,action,status,risk")
      : kind === "leads" ? db.from("leads").select("id,full_name,zone,score,phase,status")
      : db.from("agents").select("id,name,code,status,enabled,last_run_at,last_error");
    const { data, error } = await query.eq("organization_id", organization_id).order("id").limit(limit).abortSignal(ctx.signal);
    if (error) throw new ToolError("No se pudieron consultar los registros autorizados.");
    return { content: [{ type: "text", text: JSON.stringify({ kind, records: data ?? [] }) }] };
  },
});