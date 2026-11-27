import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateCommercialInput } from "./commercial-input";
import { assertOperationRole, checked } from "./operational-guards";

export const saveClientCommercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCommercialInput)
  .handler(async ({ data, context }) => {
    const { data: member } = await checked(
      context.supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", data.organizationId)
        .eq("user_id", context.userId)
        .maybeSingle(),
    );
    assertOperationRole(member?.role);
    const traceId = crypto.randomUUID();
    await checked(
      context.supabase
        .from("clients")
        .update({
          status: data.status,
          currency: data.currency,
          mrr: data.mrr,
          next_action: data.nextAction,
          next_follow_up_at: data.nextFollowUpAt,
        })
        .eq("id", data.clientId)
        .eq("organization_id", data.organizationId)
        .select("id")
        .single(),
    );
    await checked(
      context.supabase.from("activity_logs").insert({
        organization_id: data.organizationId,
        actor_type: "human",
        actor_user: context.userId,
        action: "client.commercial_updated",
        entity_type: "client",
        entity_id: data.clientId,
        detail: {
          status: data.status,
          currency: data.currency,
          mrr: data.mrr,
          next_follow_up_at: data.nextFollowUpAt,
        },
        trace_id: traceId,
      }),
    );
    return { traceId };
  });
