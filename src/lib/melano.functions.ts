import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Serializable = string | number | boolean | null | Serializable[] | { [k: string]: Serializable };

export const runMeetingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN", "OPERATOR"].includes(member.role)) {
      throw new Error("Sin permisos para ejecutar la reunión");
    }
    const { runExecutiveMeetingServer } = await import("./melano-ai.server");
    const result = await runExecutiveMeetingServer({
      orgId: data.organizationId,
      trigger: "manual",
    });
    return { meetingId: result.meetingId, traceId: result.traceId };
  });

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentId: string; organizationId: string }) => {
    if (!input?.agentId || !input?.organizationId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN", "OPERATOR"].includes(member.role)) {
      throw new Error("Sin permisos para ejecutar agentes");
    }
    const { runAgentServer } = await import("./melano-ai.server");
    const { parsed, traceId } = await runAgentServer(data.agentId);
    return { traceId, output: JSON.parse(JSON.stringify(parsed)) as Record<string, Serializable> };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string; approve: boolean; note?: string }) => {
    if (!input?.approvalId) throw new Error("approvalId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: approval, error } = await context.supabase
      .from("approvals")
      .update({
        status: data.approve ? "APPROVED" : "REJECTED",
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.approvalId)
      .eq("status", "PENDING")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!approval) throw new Error("Aprobación no encontrada o ya resuelta");

    if (approval.decision_id) {
      await context.supabase
        .from("decisions")
        .update({
          status: data.approve ? "APPROVED" : "REJECTED",
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", approval.decision_id);
    }

    await context.supabase.from("activity_logs").insert({
      organization_id: approval.organization_id,
      actor_type: "human",
      actor_user: context.userId,
      action: data.approve ? "approval.approved" : "approval.rejected",
      entity_type: "approval",
      entity_id: approval.id,
      detail: { action: approval.action, note: data.note ?? null },
      trace_id: approval.trace_id,
    });

    return { status: approval.status };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["CEO", "ADMIN"].includes(member.role)) {
      throw new Error("Sólo CEO o ADMIN pueden limpiar datos demo");
    }
    const tables = [
      "approvals",
      "tasks",
      "decisions",
      "alerts",
      "metrics",
      "projects",
      "automation_rules",
    ] as const;
    for (const table of tables) {
      await context.supabase
        .from(table)
        .delete()
        .eq("organization_id", data.organizationId)
        .eq("is_demo", true);
    }
    return { ok: true };
  });

export const setAutonomyLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; level: number }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    if (input.level < 0 || input.level > 5) throw new Error("Nivel inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organizations")
      .update({ autonomy_level: data.level })
      .eq("id", data.organizationId);
    if (error) throw error;
    return { level: data.level };
  });

/* ── Administración: invitaciones, organizaciones y políticas ────────────── */

const ADMIN_ROLES = ["CEO", "ADMIN"] as const;
type AdminContext = { supabase: { from: (t: string) => any }; userId: string };

async function assertAdmin(context: AdminContext, organizationId: string) {
  const { data: member } = await context.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    throw new Error("Sólo CEO o ADMIN pueden administrar la organización");
  }
  return member.role as string;
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; email: string; role: string; days?: number }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    const email = (input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
    if (!["CEO", "ADMIN", "OPERATOR", "VIEWER", "AGENT"].includes(input.role)) {
      throw new Error("Rol inválido");
    }
    const days = Math.min(Math.max(input.days ?? 14, 1), 90);
    return { organizationId: input.organizationId, email, role: input.role, days };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresAt = new Date(Date.now() + data.days * 86_400_000).toISOString();

    const { data: invite, error } = await supabaseAdmin
      .from("organization_invites")
      .insert({
        organization_id: data.organizationId,
        email: data.email,
        role: data.role as never,
        invited_by: context.userId,
        expires_at: expiresAt,
      })
      .select("id, email, role, expires_at, created_at, accepted_at")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "org.invite_created",
      entity_type: "organization_invite",
      entity_id: invite.id,
      detail: { email: data.email, role: data.role },
    });
    return { id: invite.id as string, email: invite.email as string };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; inviteId: string }) => {
    if (!input?.organizationId || !input?.inviteId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_invites")
      .delete()
      .eq("id", data.inviteId)
      .eq("organization_id", data.organizationId)
      .is("accepted_at", null);
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "org.invite_revoked",
      entity_type: "organization_invite",
      entity_id: data.inviteId,
      detail: {},
    });
    return { ok: true };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; slug: string; tagline?: string; timezone?: string }) => {
    const name = (input?.name ?? "").trim();
    const slug = (input?.slug ?? "").trim().toLowerCase();
    if (name.length < 2) throw new Error("Nombre demasiado corto");
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error("Slug inválido (a-z, 0-9, guiones)");
    return {
      name,
      slug,
      tagline: (input.tagline ?? "").trim() || null,
      timezone: (input.timezone ?? "").trim() || "America/Argentina/Buenos_Aires",
    };
  })
  .handler(async ({ data, context }) => {
    // Sólo quien ya es CEO/ADMIN en alguna organización puede crear otra.
    const { data: memberships } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (memberships ?? []).some((m: { role: string }) =>
      ADMIN_ROLES.includes(m.role as never),
    );
    if (!allowed) throw new Error("Sólo CEO o ADMIN pueden crear organizaciones");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        slug: data.slug,
        tagline: data.tagline,
        timezone: data.timezone,
      })
      .select("id, name, slug")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: context.userId, role: "CEO" });
    if (memberError) throw new Error(memberError.message);

    await supabaseAdmin.from("activity_logs").insert({
      organization_id: org.id,
      actor_type: "human",
      actor_user: context.userId,
      action: "org.created",
      entity_type: "organization",
      entity_id: org.id,
      detail: { name: data.name, slug: data.slug },
    });
    return { id: org.id as string, name: org.name as string, slug: org.slug as string };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; userId: string; role: string }) => {
    if (!input?.organizationId || !input?.userId) throw new Error("Parámetros inválidos");
    if (!["CEO", "ADMIN", "OPERATOR", "VIEWER", "AGENT"].includes(input.role)) {
      throw new Error("Rol inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    if (data.userId === context.userId) throw new Error("No podés cambiar tu propio rol");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_members")
      .update({ role: data.role as never })
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "org.member_role_updated",
      entity_type: "organization_member",
      entity_id: null,
      detail: { user_id: data.userId, role: data.role },
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; userId: string }) => {
    if (!input?.organizationId || !input?.userId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    if (data.userId === context.userId) throw new Error("No podés quitarte a vos mismo");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "org.member_removed",
      entity_type: "organization_member",
      entity_id: null,
      detail: { user_id: data.userId },
    });
    return { ok: true };
  });

export const listAdminData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: invites }, { data: members }, { data: orgs }] = await Promise.all([
      supabaseAdmin
        .from("organization_invites")
        .select("id, email, role, expires_at, accepted_at, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("organization_members")
        .select("user_id, role, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("organization_members")
        .select("role, organizations(id, name, slug, autonomy_level)")
        .eq("user_id", context.userId),
    ]);

    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

    return {
      invites: (invites ?? []) as {
        id: string;
        email: string;
        role: string;
        expires_at: string;
        accepted_at: string | null;
        created_at: string;
      }[],
      members: (members ?? []).map((m: { user_id: string; role: string; created_at: string }) => {
        const p = (profiles ?? []).find((x: { id: string }) => x.id === m.user_id);
        return {
          userId: m.user_id,
          role: m.role,
          createdAt: m.created_at,
          email: p?.email ?? null,
          fullName: p?.full_name ?? null,
        };
      }),
      organizations: (orgs ?? [])
        .map((row: { role: string; organizations: { id: string; name: string; slug: string; autonomy_level: number } | null }) =>
          row.organizations
            ? {
                id: row.organizations.id,
                name: row.organizations.name,
                slug: row.organizations.slug,
                autonomyLevel: row.organizations.autonomy_level,
                role: row.role,
              }
            : null,
        )
        .filter(Boolean) as { id: string; name: string; slug: string; autonomyLevel: number; role: string }[],
      me: context.userId,
    };
  });
