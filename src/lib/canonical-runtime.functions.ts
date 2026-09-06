import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { n8nWebhookHeaders } from "@/lib/n8n-headers";

const FALLBACK_COMMAND_CENTER_WEBHOOK = "https://melanoinc.app.n8n.cloud/webhook/command-center";

function commandCenterWebhookUrl() {
  const runtime = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return runtime?.["N8N_COMMAND_CENTER_WEBHOOK"]?.trim() || FALLBACK_COMMAND_CENTER_WEBHOOK;
}

export const runCanonicalBoardNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => {
    if (!input?.tenantId) throw new Error("tenantId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (table: string) => any };
    const { data: member, error } = await db
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw error;
    const role = String(member?.role ?? "").toLowerCase();
    if (!member || !["owner", "admin", "operator"].includes(role)) {
      throw new Error("Sin permisos para ejecutar el Board");
    }

    const traceId = crypto.randomUUID();
    const response = await fetch(commandCenterWebhookUrl(), {
      method: "POST",
      headers: n8nWebhookHeaders(),
      body: JSON.stringify({
        event: "board.execute",
        source: "command-center-ui",
        tenant_id: data.tenantId,
        organization_id: data.tenantId,
        trace_id: traceId,
        data: { trigger: "manual" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`n8n rechazó la ejecución (${response.status}): ${body.slice(0, 240)}`);
    }

    return { accepted: true, traceId };
  });
