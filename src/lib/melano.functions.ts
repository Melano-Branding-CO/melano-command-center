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

/* ------------------------------------------------------------------ */
/* Clientes (CEO / ADMIN)                                              */
/* ------------------------------------------------------------------ */

export type ClientInput = {
  id?: string;
  organizationId: string;
  name: string;
  legalName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  segment?: string | null;
  status?: string;
  luxiaStage?: string;
  plan?: string | null;
  mrr?: number;
  currency?: string;
  nextAction?: string | null;
  onboardingAt?: string | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  ownerUser?: string | null;
};

const CLIENT_STATUS = ["PROSPECTO", "ONBOARDING", "ACTIVO", "PAUSADO", "CERRADO"];
const CLIENT_STAGE = ["FASE_0_14", "FASE_15_45", "FASE_46_90"];

function clean(value?: string | null) {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { data: rows, error } = await context.supabase
      .from("clients")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { clients: (rows ?? []) as unknown as Record<string, Serializable>[] };
  });

export const saveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ClientInput) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    if (!clean(input.name)) throw new Error("El nombre del cliente es obligatorio");
    const email = clean(input.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
    if (input.status && !CLIENT_STATUS.includes(input.status)) throw new Error("Estado inválido");
    if (input.luxiaStage && !CLIENT_STAGE.includes(input.luxiaStage)) {
      throw new Error("Etapa LUXIA inválida");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const payload = {
      organization_id: data.organizationId,
      name: clean(data.name)!,
      legal_name: clean(data.legalName),
      contact_name: clean(data.contactName),
      email: clean(data.email),
      phone: clean(data.phone),
      website: clean(data.website),
      city: clean(data.city),
      segment: clean(data.segment),
      status: data.status ?? "PROSPECTO",
      luxia_stage: (data.luxiaStage ?? "FASE_0_14") as never,
      plan: clean(data.plan),
      mrr: Number.isFinite(data.mrr) ? Number(data.mrr) : 0,
      currency: data.currency ?? "ARS",
      next_action: clean(data.nextAction),
      onboarding_at: clean(data.onboardingAt),
      last_contact_at: clean(data.lastContactAt),
      next_follow_up_at: clean(data.nextFollowUpAt),
      notes: clean(data.notes),
      owner_user: clean(data.ownerUser),
    };


    const query = data.id
      ? context.supabase.from("clients").update(payload).eq("id", data.id).select("id, name").single()
      : context.supabase.from("clients").insert(payload).select("id, name").single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: data.id ? "client.updated" : "client.created",
      entity_type: "client",
      entity_id: row.id,
      detail: {
        name: payload.name,
        status: payload.status,
        luxia_stage: data.luxiaStage ?? "FASE_0_14",
        mrr: payload.mrr,
        currency: payload.currency,
      },
    });

    return { id: row.id as string, name: row.name as string };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; clientId: string }) => {
    if (!input?.organizationId || !input?.clientId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { data: row, error } = await context.supabase
      .from("clients")
      .delete()
      .eq("id", data.clientId)
      .eq("organization_id", data.organizationId)
      .select("name")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "client.deleted",
      entity_type: "client",
      detail: { name: row.name },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Cartera del operador (clientes asignados)                           */
/* ------------------------------------------------------------------ */

/** Miembros con rol OPERATOR, para que CEO/ADMIN asignen cartera. */
export const listAssignableOperators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { data: members, error } = await context.supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", data.organizationId)
      .in("role", ["OPERATOR", "ADMIN", "CEO"]);
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

    return {
      operators: (members ?? []).map((m) => {
        const p = (profiles ?? []).find((row) => row.id === m.user_id);
        return {
          userId: m.user_id as string,
          role: m.role as string,
          email: p?.email ?? null,
          fullName: p?.full_name ?? null,
        };
      }),
    };
  });

/** Clientes asignados al usuario autenticado (RLS también lo restringe). */
export const listMyClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("clients")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("owner_user", context.userId)
      .order("next_follow_up_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const { data: logs } = ids.length
      ? await context.supabase
          .from("activity_logs")
          .select("id, action, detail, created_at, entity_id")
          .eq("organization_id", data.organizationId)
          .eq("entity_type", "client")
          .in("entity_id", ids)
          .order("created_at", { ascending: false })
          .limit(120)
      : { data: [] as Record<string, unknown>[] };

    return {
      clients: (rows ?? []) as unknown as Record<string, Serializable>[],
      logs: (logs ?? []) as unknown as Record<string, Serializable>[],
      me: context.userId,
    };
  });

/** Registro de seguimiento sobre un cliente asignado: actualiza y audita. */
export const logClientTouch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      organizationId: string;
      clientId: string;
      note: string;
      nextAction?: string | null;
      nextFollowUpAt?: string | null;
      status?: string;
    }) => {
      if (!input?.organizationId || !input?.clientId) throw new Error("Parámetros inválidos");
      if (!(input.note ?? "").trim()) throw new Error("La nota de seguimiento es obligatoria");
      if (input.status && !CLIENT_STATUS.includes(input.status)) throw new Error("Estado inválido");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const nextAction = clean(data.nextAction);
    const nextFollowUpAt = clean(data.nextFollowUpAt);
    const update: {
      last_contact_at: string;
      next_action?: string;
      next_follow_up_at?: string;
      status?: string;
    } = { last_contact_at: new Date().toISOString() };
    if (nextAction) update.next_action = nextAction;
    if (nextFollowUpAt) update.next_follow_up_at = nextFollowUpAt;
    if (data.status) update.status = data.status;

    const { data: row, error } = await context.supabase
      .from("clients")
      .update(update)
      .eq("id", data.clientId)
      .eq("organization_id", data.organizationId)
      .eq("owner_user", context.userId)
      .select("id, name, luxia_stage, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("El cliente no está asignado a tu cartera");

    const { error: logError } = await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "client.follow_up",
      entity_type: "client",
      entity_id: row.id,
      detail: {
        name: row.name,
        note: data.note.trim(),
        luxia_stage: row.luxia_stage,
        status: row.status,
        next_action: nextAction,
        next_follow_up_at: nextFollowUpAt,
      },
    });
    if (logError) throw new Error(logError.message);
    return { ok: true };
  });

/* ============================ Panel de asignaciones ============================ */

const TASK_PRIORITY = ["P0", "P1", "P2", "P3"];
const TASK_STATUS = ["BACKLOG", "READY", "RUNNING", "BLOCKED", "REVIEW", "DONE", "FAILED"];

type AssignmentInput = {
  organizationId: string;
  id?: string | undefined;
  title: string;
  description?: string | null;
  successMetric?: string | null;
  whyNow?: string | null;
  nextAction?: string | null;
  priority?: string;
  status?: string;
  assignedUser?: string | null;
  assignedAgent?: string | null;
  deadline?: string | null;
  isTodayPriority?: boolean;
};

/** Miembros de la organización (para asignar responsables). Sólo CEO/ADMIN. */
export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { data: members, error } = await context.supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
    return {
      members: (members ?? []).map((m) => {
        const p = (profiles ?? []).find((row) => row.id === m.user_id);
        return {
          userId: m.user_id as string,
          role: m.role as string,
          email: p?.email ?? null,
          fullName: p?.full_name ?? null,
        };
      }),
    };
  });

/** Alta/edición de una asignación (tarea con objetivo y responsable). Sólo CEO/ADMIN. */
export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssignmentInput) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    if (!clean(input.title)) throw new Error("El título de la tarea es obligatorio");
    if (input.priority && !TASK_PRIORITY.includes(input.priority)) throw new Error("Prioridad inválida");
    if (input.status && !TASK_STATUS.includes(input.status)) throw new Error("Estado inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const payload: Record<string, Serializable> = {
      organization_id: data.organizationId,
      title: clean(data.title)!,
      description: clean(data.description),
      success_metric: clean(data.successMetric),
      why_now: clean(data.whyNow),
      next_action: clean(data.nextAction),
      priority: data.priority ?? "P2",
      status: data.status ?? "READY",
      assigned_user: clean(data.assignedUser),
      assigned_agent: clean(data.assignedAgent),
      deadline: clean(data.deadline),
      is_today_priority: !!data.isTodayPriority,
      today_date: data.isTodayPriority ? new Date().toISOString().slice(0, 10) : null,
      execution_mode: "MANUAL",
    };
    if (!data.id) payload['created_by'] = context.userId;

    const query = data.id
      ? context.supabase
          .from("tasks")
          .update(payload as never)
          .eq("id", data.id)
          .eq("organization_id", data.organizationId)
          .select("id, title")
          .single()
      : context.supabase
          .from("tasks")
          .insert(payload as never)
          .select("id, title")
          .single();

    const { data: row, error } = await query;
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: data.id ? "task.assignment_updated" : "task.assignment_created",
      entity_type: "task",
      entity_id: row.id,
      detail: {
        title: row.title,
        assigned_user: clean(data.assignedUser),
        assigned_agent: clean(data.assignedAgent),
        priority: data.priority ?? "P2",
        status: data.status ?? "READY",
        success_metric: clean(data.successMetric),
        deadline: clean(data.deadline),
      },
    });

    return { id: row.id as string };
  });

/** Avance de una asignación por su responsable (RLS restringe a assigned_user = auth.uid()). */
export const updateMyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      organizationId: string;
      taskId: string;
      status: string;
      nextAction?: string | null;
      result?: string | null;
    }) => {
      if (!input?.organizationId || !input?.taskId) throw new Error("Parámetros inválidos");
      if (!TASK_STATUS.includes(input.status)) throw new Error("Estado inválido");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const update: Record<string, Serializable> = { status: data.status };
    const nextAction = clean(data.nextAction);
    const result = clean(data.result);
    if (nextAction) update['next_action'] = nextAction;
    if (result) update['result'] = result;
    if (data.status === "RUNNING") update['started_at'] = new Date().toISOString();
    if (data.status === "DONE") update['completed_at'] = new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("tasks")
      .update(update as never)
      .eq("id", data.taskId)
      .eq("organization_id", data.organizationId)
      .eq("assigned_user", context.userId)
      .select("id, title, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("La tarea no está asignada a tu usuario");

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "human",
      actor_user: context.userId,
      action: "task.progress",
      entity_type: "task",
      entity_id: row.id,
      detail: { title: row.title, status: row.status, next_action: nextAction, result },
    });
    return { ok: true };
  });

/* ────────────────────────────── n8n (bidireccional) ────────────────────────────── */

type N8nRuleInput = {
  organizationId: string;
  id?: string | undefined;
  name: string;
  description?: string | null | undefined;
  webhookUrl?: string | null | undefined;
  workflow?: string | null | undefined;
  enabled?: boolean | undefined;
};

/** Alta/edición de una automatización conectada a un workflow de n8n. Sólo CEO/ADMIN. */
export const saveN8nAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: N8nRuleInput) => {
    if (!input?.organizationId) throw new Error("organizationId requerido");
    if (!input?.name?.trim()) throw new Error("El nombre es obligatorio");
    const url = input.webhookUrl?.trim() || null;
    if (url && !/^https:\/\/[^\s]+$/i.test(url)) {
      throw new Error("La URL del webhook debe ser https://");
    }
    return { ...input, name: input.name.trim(), webhookUrl: url };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const payload = {
      organization_id: data.organizationId,
      name: data.name,
      description: data.description ?? null,
      n8n_webhook_url: data.webhookUrl ?? null,
      n8n_workflow: data.workflow?.trim() || null,
      enabled: data.enabled ?? true,
      trigger: "webhook" as const,
      action: "n8n_webhook",
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("automation_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Ejecuta el workflow de n8n de una automatización y deja run + log auditables. */
export const runN8nAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; ruleId: string; payload?: Serializable | undefined }) => {
    if (!input?.organizationId || !input?.ruleId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organizationId);
    const { data: rule, error } = await context.supabase
      .from("automation_rules")
      .select("id, name, n8n_webhook_url, enabled")
      .eq("id", data.ruleId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rule) throw new Error("Automatización no encontrada");
    if (!rule.n8n_webhook_url) throw new Error("Esta automatización no tiene webhook de n8n");
    if (!rule.enabled) throw new Error("La automatización está pausada");

    const traceId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const { data: run } = await context.supabase
      .from("automation_runs")
      .insert({
        organization_id: data.organizationId,
        rule_id: rule.id,
        status: "RUNNING",
        started_at: startedAt,
        trace_id: traceId,
      })
      .select("id")
      .single();

    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    let output = "";
    let errorText: string | null = null;
    try {
      const res = await fetch(rule.n8n_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "melano-command-center",
          organization_id: data.organizationId,
          rule_id: rule.id,
          rule_name: rule.name,
          trace_id: traceId,
          triggered_by: context.userId,
          triggered_at: startedAt,
          payload: data.payload ?? null,
        }),
      });
      output = (await res.text()).slice(0, 4000);
      if (!res.ok) {
        status = "FAILED";
        errorText = `HTTP ${res.status}`;
      }
    } catch (err) {
      status = "FAILED";
      errorText = err instanceof Error ? err.message : String(err);
    }

    const finishedAt = new Date().toISOString();
    if (run?.id) {
      await context.supabase
        .from("automation_runs")
        .update({ status, finished_at: finishedAt, output, error: errorText })
        .eq("id", run.id);
    }
    await context.supabase
      .from("automation_rules")
      .update({
        last_run_at: finishedAt,
        last_result: status === "SUCCESS" ? output.slice(0, 500) || "OK" : null,
        last_error: errorText,
        status: status === "SUCCESS" ? "OK" : "ERROR",
      })
      .eq("id", rule.id);
    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "user",
      actor_user: context.userId,
      action: "n8n.trigger",
      entity_type: "automation_rules",
      entity_id: rule.id,
      trace_id: traceId,
      detail: { rule: rule.name, status, error: errorText } as never,
    });

    if (status === "FAILED") throw new Error(errorText ?? "Error llamando a n8n");
    return { traceId, output };
  });

/* ──────────────────── Ejecución de tareas en n8n (task → workflow) ──────────────────── */

const TASK_RUN_ROLES = ["CEO", "ADMIN", "OPERATOR"];

/**
 * Envía una tarea a un workflow de n8n y deja traza auditable:
 * automation_runs + activity_logs (n8n.task) + estado/resultado en la tarea.
 */
export const runTaskInN8n = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; taskId: string; ruleId?: string | undefined }) => {
    if (!input?.organizationId || !input?.taskId) throw new Error("Parámetros inválidos");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !TASK_RUN_ROLES.includes(member.role)) {
      throw new Error("Sin permisos para ejecutar tareas en n8n");
    }

    const { data: task, error: taskError } = await context.supabase
      .from("tasks")
      .select(
        "id, title, description, priority, status, next_action, success_metric, why_now, deadline, meeting_id, decision_id, assigned_agent, assigned_user, trace_id",
      )
      .eq("id", data.taskId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (taskError) throw new Error(taskError.message);
    if (!task) throw new Error("Tarea no encontrada");

    let ruleQuery = context.supabase
      .from("automation_rules")
      .select("id, name, n8n_webhook_url, n8n_workflow, enabled")
      .eq("organization_id", data.organizationId)
      .eq("enabled", true)
      .not("n8n_webhook_url", "is", null);
    if (data.ruleId) ruleQuery = ruleQuery.eq("id", data.ruleId);
    const { data: rules, error: ruleError } = await ruleQuery.order("created_at").limit(1);
    if (ruleError) throw new Error(ruleError.message);
    const rule = rules?.[0];
    if (!rule?.n8n_webhook_url) {
      throw new Error("No hay workflow de n8n activo. Configuralo en Automations.");
    }

    const traceId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const { data: run } = await context.supabase
      .from("automation_runs")
      .insert({
        organization_id: data.organizationId,
        rule_id: rule.id,
        status: "RUNNING",
        started_at: startedAt,
        trace_id: traceId,
      })
      .select("id")
      .single();

    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    let output = "";
    let errorText: string | null = null;
    try {
      const res = await fetch(rule.n8n_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "melano-command-center",
          event: "task.execute",
          organization_id: data.organizationId,
          rule_id: rule.id,
          rule_name: rule.name,
          workflow: rule.n8n_workflow,
          trace_id: traceId,
          triggered_by: context.userId,
          triggered_at: startedAt,
          task,
        }),
      });
      output = (await res.text()).slice(0, 4000);
      if (!res.ok) {
        status = "FAILED";
        errorText = `HTTP ${res.status}`;
      }
    } catch (err) {
      status = "FAILED";
      errorText = err instanceof Error ? err.message : String(err);
    }

    const finishedAt = new Date().toISOString();
    if (run?.id) {
      await context.supabase
        .from("automation_runs")
        .update({ status, finished_at: finishedAt, output, error: errorText })
        .eq("id", run.id);
    }
    await context.supabase
      .from("automation_rules")
      .update({
        last_run_at: finishedAt,
        last_result: status === "SUCCESS" ? output.slice(0, 500) || "OK" : null,
        last_error: errorText,
        status: status === "SUCCESS" ? "OK" : "ERROR",
      })
      .eq("id", rule.id);

    await context.supabase
      .from("tasks")
      .update(
        status === "SUCCESS"
          ? {
              status: "RUNNING",
              started_at: startedAt,
              trace_id: traceId,
              result: `n8n · ${rule.n8n_workflow ?? rule.name}: ${output.slice(0, 300) || "OK"}`,
              error: null,
            }
          : { trace_id: traceId, error: `n8n · ${errorText}` },
      )
      .eq("id", task.id)
      .eq("organization_id", data.organizationId);

    await context.supabase.from("activity_logs").insert({
      organization_id: data.organizationId,
      actor_type: "user",
      actor_user: context.userId,
      action: "n8n.task",
      entity_type: "task",
      entity_id: task.id,
      trace_id: traceId,
      detail: {
        task: task.title,
        rule: rule.name,
        workflow: rule.n8n_workflow,
        status,
        error: errorText,
        output: output.slice(0, 500),
      } as never,
    });

    if (status === "FAILED") throw new Error(errorText ?? "Error llamando a n8n");
    return { traceId, output, rule: rule.n8n_workflow ?? rule.name };
  });
