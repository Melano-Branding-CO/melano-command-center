import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_organizations",
  title: "Consultar organizaciones autorizadas",
  description: "Lista las organizaciones de las que el usuario es miembro, para obtener su identificador antes de consultar registros.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const db = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Iniciá sesión para consultar esta app.");
    const { data: membership, error: membershipError } = await db.from("organization_members")
      .select("organization_id").eq("user_id", userId).limit(50).abortSignal(ctx.signal);
    if (membershipError) throw new ToolError("No se pudieron consultar tus organizaciones.");
    const ids = (membership ?? []).map(row => row.organization_id);
    if (!ids.length) return { content: [{ type: "text", text: "No tenés organizaciones autorizadas." }] };
    const { data, error } = await db.from("organizations").select("id,name").in("id", ids).limit(50).abortSignal(ctx.signal);
    if (error) throw new ToolError("No se pudieron consultar tus organizaciones.");
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  },
});