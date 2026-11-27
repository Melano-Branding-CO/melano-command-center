// Server-only: orquestación de MELANIA y ejecución de agentes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_MODEL as MODEL, requestAiCompletion } from "./ai-gateway.server";
import { requireAiConfiguration } from "./ai-status.server";
import { assertAgentScope, checked } from "./operational-guards";
import { summarizeRevenue, type RevenueClient, type RevenueLead } from "./revenue-summary";

import type { Json as DbJson } from "@/integrations/supabase/types";

export type Json = DbJson;

export type AiResult = { text: string; tokens: number; model: string; ms: number };

async function aiFull(system: string, user: string): Promise<AiResult> {
  const key = process.env["AI_GATEWAY_API_KEY"] || process.env["VERCEL_OIDC_TOKEN"];
  return requestAiCompletion(system, user, key);
}

async function ai(system: string, user: string): Promise<string> {
  return (await aiFull(system, user)).text;
}

function parseJson<T>(text: string, fallback: T): T {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return fallback;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}

async function loadOrgContext(orgId: string) {
  const db = supabaseAdmin;
  const [tasks, decisions, approvals, metrics, alerts, products] = await Promise.all([
    db
      .from("tasks")
      .select("title,status,priority,deadline,success_metric,assigned_agent")
      .eq("organization_id", orgId)
      .not("status", "in", "(DONE,FAILED)")
      .limit(40),
    db
      .from("decisions")
      .select("title,status,priority,expected_impact,risk")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("approvals")
      .select("action,category,risk,status")
      .eq("organization_id", orgId)
      .eq("status", "PENDING")
      .limit(20),
    db
      .from("metrics")
      .select("key,label,value,unit,captured_at")
      .eq("organization_id", orgId)
      .neq("category", "revenue")
      .order("captured_at", { ascending: false })
      .limit(30),
    db
      .from("alerts")
      .select("title,severity,status")
      .eq("organization_id", orgId)
      .eq("status", "OPEN")
      .limit(20),
    db.from("products").select("code,name,status,priority").eq("organization_id", orgId),
  ]);

  for (const response of [tasks, decisions, approvals, metrics, alerts, products]) {
    if (response.error) throw new Error(`No se pudo leer el contexto: ${response.error.message}`);
  }
  // Use the same current records as Revenue; historical revenue snapshots are excluded.
  const clients: RevenueClient[] = [];
  const leads: RevenueLead[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await checked(
      db
        .from("clients")
        .select("id,organization_id,name,status,currency,mrr,is_demo,next_action,next_follow_up_at")
        .eq("organization_id", orgId)
        .eq("is_demo", false)
        .order("id")
        .range(offset, offset + 999),
    );
    clients.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data } = await checked(
      db
        .from("leads")
        .select("id,organization_id,status,is_demo,next_follow_up_at")
        .eq("organization_id", orgId)
        .eq("is_demo", false)
        .order("id")
        .range(offset, offset + 999),
    );
    leads.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return JSON.stringify(
    {
      revenue_actual_registrado_no_acredita_cobros: summarizeRevenue(
        clients,
        leads,
        orgId,
        new Date().toISOString(),
      ),
      tareas_abiertas: tasks.data ?? [],
      decisiones_recientes: decisions.data ?? [],
      aprobaciones_pendientes: approvals.data ?? [],
      metricas: metrics.data ?? [],
      alertas: alerts.data ?? [],
      productos: products.data ?? [],
    },
    null,
    1,
  ).slice(0, 12000);
}

export async function resolveOrgId(orgId?: string): Promise<string> {
  if (orgId) return orgId;
  const { data, error } = await supabaseAdmin.from("organizations").select("id").limit(1);
  if (error) throw error;
  const id = data?.[0]?.id;
  if (!id) throw new Error("No hay organización configurada");
  return id;
}

const AGENT_SCHEMA = `Respondé SOLO con JSON válido con esta forma:
{"situation":"...","changes":"...","problems":"...","opportunities":"...","metrics":{"clave":"valor"},"proposed_action":"..."}
Reglas: nunca inventes datos como hechos. Si no hay evidencia en el contexto, escribí "SIN DATOS" y marcá el supuesto explícitamente.`;

type AgentRowFull = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  role: string;
  objective: string;
  system_prompt: string;
  context: string | null;
  execution_loop: string | null;
  stop_conditions: string | null;
  failure_handling: string | null;
  observability: string | null;
  measurable_outcome: string | null;
  execution_mode: string;
  tools: DbJson;
};

/** Prompt real del agente: system_prompt + toda su ficha operativa. */
export function buildAgentPrompt(agent: AgentRowFull, toolNames: string[]): string {
  const section = (label: string, value?: string | null) =>
    value && value.trim() ? `\n\n## ${label}\n${value.trim()}` : "";
  return (
    `${agent.system_prompt.trim()}` +
    `\n\n## Identidad\n${agent.name} (${agent.code}) — ${agent.role} de MELANO INC.` +
    `\n\n## Objetivo\n${agent.objective}` +
    section("Contexto operativo", agent.context) +
    section("Ciclo de ejecución", agent.execution_loop) +
    section("Condiciones de parada", agent.stop_conditions) +
    section("Manejo de fallos", agent.failure_handling) +
    section("Observabilidad", agent.observability) +
    section("Resultado medible esperado", agent.measurable_outcome) +
    `\n\n## Modo de ejecución\n${agent.execution_mode}` +
    (toolNames.length ? `\n\n## Herramientas habilitadas\n${toolNames.join(", ")}` : "") +
    `\n\n## Formato de salida\n${AGENT_SCHEMA}`
  );
}

const COST_PER_1K_TOKENS = 0.0003;

/** Ejecuta un agente individual con su prompt real y persiste el run completo. */
export async function runAgentServer(agentId: string, organizationId: string, meetingId?: string) {
  const db = supabaseAdmin;
  const { data: agent } = await checked(
    db
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  );
  assertAgentScope(agent, organizationId);
  if (!agent) throw new Error("DENIED: agente fuera de la organización autorizada");
  requireAiConfiguration();

  // Compare-and-set claim prevents two concurrent requests from running the same agent.
  const { data: claimed } = await checked(
    db
      .from("agents")
      .update({ status: "RUNNING" })
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .neq("status", "RUNNING")
      .select("id")
      .maybeSingle(),
  );
  if (!claimed) throw new Error("BLOQUEO: agente ya en ejecución o pausado");

  const traceId = crypto.randomUUID();
  let runId: string | null = null;
  try {
    const context = await loadOrgContext(organizationId);
    const { data: toolRows } = await checked(
      db.from("agent_tools").select("tool_name").eq("agent_id", agentId).eq("enabled", true),
    );
    const toolNames = (toolRows ?? []).map((t) => t.tool_name);
    const systemPrompt = buildAgentPrompt(agent as unknown as AgentRowFull, toolNames);
    const userPrompt = `Estado real de la organización (JSON):\n${context}\n\nProducí tu análisis ejecutivo de hoy siguiendo tu ciclo de ejecución.`;
    const { data: run } = await checked(
      db
        .from("agent_runs")
        .insert({
          organization_id: organizationId,
          agent_id: agentId,
          ...(meetingId ? { meeting_id: meetingId } : {}),
          trigger: meetingId ? ("schedule" as const) : ("manual" as const),
          status: "RUNNING" as const,
          input: {
            model: MODEL,
            agent_code: agent.code,
            system_prompt: systemPrompt,
            user_prompt_preview: userPrompt.slice(0, 2000),
            context_bytes: context.length,
            configured_tools: toolNames,
          } as unknown as DbJson,
          // These tools are context, not executed tool calls.
          tools_used: [],
          trace_id: traceId,
        })
        .select("id")
        .single(),
    );
    if (!run) throw new Error("No se pudo registrar la ejecución");
    runId = run.id;
    const result = await aiFull(systemPrompt, userPrompt);
    const parsed = parseJson<Record<string, unknown> | null>(result.text, null);
    if (
      !parsed ||
      typeof parsed["situation"] !== "string" ||
      typeof parsed["proposed_action"] !== "string"
    ) {
      throw new Error("BLOQUEO: la IA devolvió un análisis con formato inválido");
    }
    await checked(
      db.from("activity_logs").insert({
        organization_id: organizationId,
        actor_type: "agent",
        actor_agent: agentId,
        action: "agent.run.success",
        entity_type: "agent",
        entity_id: agentId,
        detail: {
          proposed_action: parsed["proposed_action"] as DbJson,
          tokens: result.tokens,
          duration_ms: result.ms,
          model: result.model,
          run_id: runId,
        },
        trace_id: traceId,
      }),
    );
    await checked(
      db
        .from("agents")
        .update({
          status: "ACTIVE",
          last_run_at: new Date().toISOString(),
          last_result: String(parsed["proposed_action"]).slice(0, 500),
          last_error: null,
        })
        .eq("id", agentId)
        .eq("organization_id", organizationId),
    );
    await checked(
      db
        .from("agent_runs")
        .update({
          status: "SUCCESS",
          finished_at: new Date().toISOString(),
          output: parsed as DbJson,
          tokens: result.tokens,
          estimated_cost: Number(((result.tokens / 1000) * COST_PER_1K_TOKENS).toFixed(6)),
        })
        .eq("id", runId)
        .eq("organization_id", organizationId),
    );
    return { agent, parsed, traceId, runId, tokens: result.tokens };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const outcomes = await Promise.allSettled([
      ...(runId
        ? [
            checked(
              db
                .from("agent_runs")
                .update({ status: "FAILED", finished_at: new Date().toISOString(), error: message })
                .eq("id", runId)
                .eq("organization_id", organizationId),
            ),
          ]
        : []),
      checked(
        db
          .from("agents")
          .update({ status: "ERROR", last_error: message })
          .eq("id", agentId)
          .eq("organization_id", organizationId),
      ),
      checked(
        db.from("activity_logs").insert({
          organization_id: organizationId,
          actor_type: "agent",
          actor_agent: agentId,
          action: "agent.run.failed",
          entity_type: "agent",
          entity_id: agentId,
          detail: { error: message },
          trace_id: traceId,
        }),
      ),
    ]);
    if (outcomes.some((outcome) => outcome.status === "rejected"))
      console.error("[agent.run] No se pudo persistir completamente el fallo", traceId);
    throw err;
  }
}

type BriefStatement = { statement: string; kind: string };
type TopItem = {
  title: string;
  why_now?: string;
  next_action?: string;
  success_metric?: string;
  owner_code?: string;
  priority?: string;
};
type DecisionItem = {
  title: string;
  description?: string;
  priority?: string;
  risk?: string;
  expected_impact?: string;
  confidence?: number;
  requires_approval?: boolean;
  category?: string;
};
type Consolidation = {
  summary?: string;
  brief?: BriefStatement[];
  contradictions?: string[];
  top3?: TopItem[];
  decisions?: DecisionItem[];
};

const PRIORITIES = ["P0", "P1", "P2", "P3"];

/** Reunión ejecutiva 06:00: cada agente aporta, MELANIA consolida y asigna. */
export async function runExecutiveMeetingServer(
  opts: { orgId?: string; trigger?: "schedule" | "manual" } = {},
) {
  requireAiConfiguration();
  const db = supabaseAdmin;
  const orgId = await resolveOrgId(opts.orgId);
  const trigger = opts.trigger ?? "manual";
  const traceId = crypto.randomUUID();
  const now = new Date();

  const { data: agents, error: agentsError } = await db
    .from("agents")
    .select("*")
    .eq("organization_id", orgId)
    .eq("enabled", true)
    .order("sort_order")
    .throwOnError();
  if (agentsError) throw agentsError;

  const melania = (agents ?? []).find((a) => a.code === "MELANIA");
  const specialists = (agents ?? []).filter((a) => a.code !== "MELANIA");
  if (!specialists.length)
    throw new Error("BLOQUEO: no hay especialistas habilitados para la reunión");

  const { data: meeting, error: meetingError } = await db
    .from("executive_meetings")
    .insert({
      organization_id: orgId,
      title: `Reunión ejecutiva ${now.toLocaleDateString("es-AR")}`,
      scheduled_for: now.toISOString(),
      started_at: now.toISOString(),
      status: "RUNNING" as const,
      trigger,
      trace_id: traceId,
    })
    .select("*")
    .single()
    .throwOnError();
  if (meetingError || !meeting) throw meetingError ?? new Error("No se pudo crear la reunión");

  try {
    const results: { code: string; name: string; output: Record<string, unknown> }[] = [];
    // Stop on the first rejected execution: no fan-out on invalid credentials or exhausted credit.
    for (const agent of specialists) {
      const { parsed } = await runAgentServer(agent.id, orgId, meeting.id);
      await checked(
        db.from("meeting_participants").insert({
          organization_id: orgId,
          meeting_id: meeting.id,
          agent_id: agent.id,
          role_in_meeting: agent.role,
        }),
      );
      await checked(
        db.from("meeting_outputs").insert({
          organization_id: orgId,
          meeting_id: meeting.id,
          agent_id: agent.id,
          situation: String(parsed["situation"] ?? ""),
          changes: String(parsed["changes"] ?? ""),
          problems: String(parsed["problems"] ?? ""),
          opportunities: String(parsed["opportunities"] ?? ""),
          metrics: (parsed["metrics"] as DbJson) ?? {},
          proposed_action: String(parsed["proposed_action"] ?? ""),
          raw: parsed as DbJson,
        }),
      );
      results.push({ code: agent.code, name: agent.name, output: parsed });
    }

    const consolidationSystem = `${melania?.system_prompt ?? "Sos MELANIA, CEO digital de MELANO INC."}
Consolidá los aportes del comité. Detectá contradicciones. Definí máximo 3 prioridades del día.
Cada afirmación del brief se clasifica como HECHO, SUPUESTO, PENDIENTE o BLOQUEO.
Nada de acciones críticas ejecutadas: pagos, producción, borrado de datos, seguridad, contratos o permisos se marcan requires_approval=true.
Respondé SOLO JSON:
{"summary":"...","brief":[{"statement":"...","kind":"HECHO|SUPUESTO|PENDIENTE|BLOQUEO"}],"contradictions":["..."],"top3":[{"title":"...","why_now":"...","next_action":"...","success_metric":"...","owner_code":"CRO","priority":"P0|P1|P2|P3"}],"decisions":[{"title":"...","description":"...","priority":"P1","risk":"...","expected_impact":"...","confidence":0.7,"requires_approval":false,"category":"growth"}]}`;

    const consolidationText = await ai(
      consolidationSystem,
      `Aportes de los agentes (JSON):\n${JSON.stringify(results).slice(0, 14000)}`,
    );
    const brief = parseJson<Consolidation | null>(consolidationText, null);
    if (
      !brief ||
      typeof brief.summary !== "string" ||
      !Array.isArray(brief.top3) ||
      !Array.isArray(brief.decisions)
    ) {
      throw new Error("BLOQUEO: la consolidación de IA no tiene un formato válido");
    }

    const { data: priorityReceipt, error: priorityError } = await db.rpc(
      "save_meeting_priorities" as never,
      {
        p_organization_id: orgId,
        p_meeting_id: meeting.id,
        p_items: brief.top3.slice(0, 3),
      } as never,
    );
    if (priorityError)
      throw new Error(`No se pudieron guardar las prioridades: ${priorityError.message}`);
    const receipt = priorityReceipt as unknown as {
      saved_items: TopItem[];
      total: number;
      day: string;
    };
    // Report the priorities actually persisted, not proposals beyond today's capacity.
    brief.top3 = receipt.saved_items;

    for (const dec of (brief.decisions ?? []).slice(0, 6)) {
      const { data: inserted } = await db
        .from("decisions")
        .insert({
          organization_id: orgId,
          meeting_id: meeting.id,
          title: dec.title,
          description: dec.description ?? null,
          source_agent: melania?.id ?? null,
          analysis: dec.description ?? null,
          priority: (PRIORITIES.includes(dec.priority ?? "") ? dec.priority : "P2") as "P2",
          status: (dec.requires_approval ? "PROPOSED" : "APPROVED") as "PROPOSED",
          expected_impact: dec.expected_impact ?? null,
          risk: dec.risk ?? null,
          confidence: typeof dec.confidence === "number" ? dec.confidence : 0.5,
          requires_approval: !!dec.requires_approval,
          trace_id: traceId,
        })
        .select("id")
        .single()
        .throwOnError();

      if (dec.requires_approval && inserted?.id) {
        await db
          .from("approvals")
          .insert({
            organization_id: orgId,
            action: dec.title,
            category: dec.category ?? "critical",
            agent_id: melania?.id ?? null,
            decision_id: inserted.id,
            reason: dec.description ?? null,
            impact: dec.expected_impact ?? null,
            risk: dec.risk ?? null,
            evidence: { meeting_id: meeting.id },
            payload: dec as unknown as DbJson,
            status: "PENDING" as const,
            trace_id: traceId,
          })
          .throwOnError();
      }
    }

    await db
      .from("executive_meetings")
      .update({
        status: "COMPLETED" as const,
        finished_at: new Date().toISOString(),
        summary: brief.summary ?? null,
        executive_brief: brief as unknown as DbJson,
      })
      .eq("id", meeting.id)
      .throwOnError();

    await db
      .from("activity_logs")
      .insert({
        organization_id: orgId,
        actor_type: "agent",
        actor_agent: melania?.id ?? null,
        action: "meeting.completed",
        entity_type: "executive_meeting",
        entity_id: meeting.id,
        detail: {
          participantes: results.length,
          top3: (brief.top3 ?? []).length,
          decisiones: (brief.decisions ?? []).length,
        },
        trace_id: traceId,
      })
      .throwOnError();

    return { meetingId: meeting.id, traceId, brief };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("executive_meetings")
      .update({
        status: "FAILED" as const,
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", meeting.id)
      .throwOnError();
    await db
      .from("activity_logs")
      .insert({
        organization_id: orgId,
        actor_type: "system",
        action: "meeting.failed",
        entity_type: "executive_meeting",
        entity_id: meeting.id,
        detail: { error: message },
        trace_id: traceId,
      })
      .throwOnError();
    throw err;
  }
}
