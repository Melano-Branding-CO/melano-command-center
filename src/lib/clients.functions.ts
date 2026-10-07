import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalItem = { id: string; title: string; status: string; created_at: string; detail: string | null };
export type PortalClient = {
  id: string;
  name: string;
  status: string;
  plan: string | null;
  next_action: string | null;
  tasks: PortalItem[];
  decisions: PortalItem[];
  approvals: PortalItem[];
};
export type PortalResult = { email: string | null; clients: PortalClient[] };

/**
 * Portal de clientes invitados. El acceso se verifica con la sesión del usuario
 * (RLS: solo ve sus propias invitaciones activas); recién después se leen los datos
 * de ESA cuenta con privilegios de servidor y columnas limitadas.
 */
export const getMyPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalResult> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    const { data: access, error } = await db
      .from("client_portal_access")
      .select("client_id, organization_id")
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    const rows = (access ?? []) as { client_id: string; organization_id: string }[];
    if (rows.length === 0) return { email, clients: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const out: PortalClient[] = [];
    for (const r of rows.slice(0, 10)) {
      const { data: c } = await admin
        .from("clients")
        .select("id, name, status, plan, next_action")
        .eq("id", r.client_id)
        .eq("organization_id", r.organization_id)
        .maybeSingle();
      if (!c) continue;
      const scoped = (t: string, cols: string) =>
        admin.from(t).select(cols).eq("client_id", c.id).eq("organization_id", r.organization_id).order("created_at", { ascending: false }).limit(50);
      const [t, d, a] = await Promise.all([
        scoped("tasks", "id, title, status, created_at, result"),
        scoped("decisions", "id, title, status, created_at, outcome"),
        admin.from("approvals").select("id, action, status, requested_at, decision_note").eq("client_id", c.id).eq("organization_id", r.organization_id).order("requested_at", { ascending: false }).limit(50),
      ]);
      out.push({
        ...c,
        tasks: (t.data ?? []).map((x: any) => ({ id: x.id, title: x.title, status: x.status, created_at: x.created_at, detail: x.result })),
        decisions: (d.data ?? []).map((x: any) => ({ id: x.id, title: x.title, status: x.status, created_at: x.created_at, detail: x.outcome })),
        approvals: (a.data ?? []).map((x: any) => ({ id: x.id, title: x.action, status: x.status, created_at: x.requested_at, detail: x.decision_note })),
      });
    }
    return { email, clients: out };
  });
