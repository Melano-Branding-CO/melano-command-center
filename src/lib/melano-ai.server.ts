// Server-only: orquestación de MELANIA y ejecución de agentes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// DeepSeek (API oficial, key propia). Si está configurada, es el motor primario.
const DEEPSEEK_MODEL = process.env["DEEPSEEK_MODEL"] ?? "deepseek-chat";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

import type { Json as DbJson } from "@/integrations/supabase/types";

export type Json = DbJson;

export type AiResult = { text: string; tokens: number; model: string; ms: number };

type ChatBody = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number };
};

async function callChat(
  endpoint: string,
  key: string,
  model: string,
  system: string,
  user: string,
): Promise<AiResult> {
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429)
      throw new Error("Límite de uso de IA alcanzado. Reintentá en unos minutos.");
    if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
    if (res.status === 401) throw new Error("Credencial de IA inválida.");
    throw new Error(`AI ${model} ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as ChatBody;
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    tokens: data.usage?.total_tokens ?? 0,
    model,
    ms: Date.now() - t0,
  };
}

async function aiFull(system: string, user: string): Promise<AiResult> {
  const deepseekKey = process.env["DEEPSEEK_API_KEY"];
  if (deepseekKey) {
    try {
      return await callChat(DEEPSEEK_ENDPOINT, deepseekKey, DEEPSEEK_MODEL, system, user);
    } catch (error) {
      console.error("[deepseek] fallo, usando modelo de respaldo:", error);
    }
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Falta DEEPSEEK_API_KEY o LOVABLE_API_KEY en el servidor");
  return callChat(GATEWAY, key, MODEL, system, user);
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

  return JSON.stringify(
    {
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
export async function runAgentServer(agentId: string, meetingId?: string) {
  const db = supabaseAdmin;
  const { data: agent, error } = await db.from("agents").select("*").eq("id", agentId).single();
  if (error || !agent) throw new Error("Agente no encontrado");

  const traceId = crypto.randomUUID();
  const context = await loadOrgContext(agent.organization_id);

  const { data: toolRows } = await db
    .from("agent_tools")
    .select("tool_name")
    .eq("agent_id", agent.id)
    .eq("enabled", true);
  const toolNames = (toolRows ?? []).map((t) => t.tool_name);

  const systemPrompt = buildAgentPrompt(agent as unknown as AgentRowFull, toolNames);
  const userPrompt = `Estado real de la organización (JSON):\n${context}\n\nProducí tu análisis ejecutivo de hoy siguiendo tu ciclo de ejecución.`;

  const { data: run } = await db
    .from("agent_runs")
    .insert({
      organization_id: agent.organization_id,
      agent_id: agent.id,
      ...(meetingId ? { meeting_id: meetingId } : {}),
      trigger: meetingId ? ("schedule" as const) : ("manual" as const),
      status: "RUNNING" as const,
      input: {
        model: MODEL,
        agent_code: agent.code,
        system_prompt: systemPrompt,
        user_prompt_preview: userPrompt.slice(0, 2000),
        context_bytes: context.length,
      } as unknown as DbJson,
      tools_used: toolNames as unknown as DbJson,
      trace_id: traceId,
    })
    .select("id")
    .single();

  await db.from("agents").update({ status: "RUNNING" }).eq("id", agent.id);

  try {
    const result = await aiFull(systemPrompt, userPrompt);
    const text = result.text;
    const parsed = parseJson<Record<string, unknown>>(text, {
      situation: text.slice(0, 800) || "SIN DATOS",
      proposed_action: "SIN DATOS",
      raw_text: text.slice(0, 4000),
    });

    if (run?.id) {
      await db
        .from("agent_runs")
        .update({
          status: "SUCCESS" as const,
          finished_at: new Date().toISOString(),
          output: parsed as unknown as DbJson,
          tokens: result.tokens,
          estimated_cost: Number(((result.tokens / 1000) * COST_PER_1K_TOKENS).toFixed(6)),
        })
        .eq("id", run.id);
    }
    await db
      .from("agents")
      .update({
        status: "ACTIVE" as const,
        last_run_at: new Date().toISOString(),
        last_result: String(parsed["proposed_action"] ?? "").slice(0, 500),
        last_error: null,
      })
      .eq("id", agent.id);

    await db.from("activity_logs").insert({
      organization_id: agent.organization_id,
      actor_type: "agent",
      actor_agent: agent.id,
      action: "agent.run.success",
      entity_type: "agent",
      entity_id: agent.id,
      detail: {
        proposed_action: (parsed["proposed_action"] ?? null) as DbJson,
        tokens: result.tokens,
        duration_ms: result.ms,
        model: result.model,
        run_id: run?.id ?? null,
      } as unknown as DbJson,
      trace_id: traceId,
    });

    return { agent, parsed, traceId, runId: run?.id ?? null, tokens: result.tokens };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (run?.id) {
      await db
        .from("agent_runs")
        .update({
          status: "FAILED" as const,
          finished_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", run.id);
    }
    await db.from("agents").update({ status: "ERROR", last_error: message }).eq("id", agent.id);
    await db.from("activity_logs").insert({
      organization_id: agent.organization_id,
      actor_type: "agent",
      actor_agent: agent.id,
      action: "agent.run.failed",
      entity_type: "agent",
      entity_id: agent.id,
      detail: { error: message },
      trace_id: traceId,
    });
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
    .order("sort_order");
  if (agentsError) throw agentsError;

  const melania = (agents ?? []).find((a) => a.code === "MELANIA");
  const specialists = (agents ?? []).filter((a) => a.code !== "MELANIA");

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
    .single();
  if (meetingError || !meeting) throw meetingError ?? new Error("No se pudo crear la reunión");

  try {
    const results = await Promise.all(
      specialists.map(async (agent) => {
        try {
          const { parsed } = await runAgentServer(agent.id, meeting.id);
          await db.from("meeting_participants").insert({
            organization_id: orgId,
            meeting_id: meeting.id,
            agent_id: agent.id,
            role_in_meeting: agent.role,
          });
          await db.from("meeting_outputs").insert({
            organization_id: orgId,
            meeting_id: meeting.id,
            agent_id: agent.id,
            situation: String(parsed["situation"] ?? ""),
            changes: String(parsed["changes"] ?? ""),
            problems: String(parsed["problems"] ?? ""),
            opportunities: String(parsed["opportunities"] ?? ""),
            metrics: (parsed["metrics"] as DbJson) ?? {},
            proposed_action: String(parsed["proposed_action"] ?? ""),
            raw: parsed as unknown as DbJson,
          });
          return { code: agent.code, name: agent.name, output: parsed };
        } catch (err) {
          return {
            code: agent.code,
            name: agent.name,
            output: { error: err instanceof Error ? err.message : String(err) },
          };
        }
      }),
    );

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
    const brief = parseJson<Consolidation>(consolidationText, {
      summary: consolidationText.slice(0, 1000),
      brief: [],
      top3: [],
      decisions: [],
    });

    const codeToAgent = new Map((agents ?? []).map((a) => [a.code, a]));
    const today = now.toISOString().slice(0, 10);

    for (const [i, item] of (brief.top3 ?? []).slice(0, 3).entries()) {
      const owner = item.owner_code ? codeToAgent.get(item.owner_code.toUpperCase()) : undefined;
      await db.from("tasks").insert({
        organization_id: orgId,
        title: item.title,
        description: item.why_now ?? null,
        meeting_id: meeting.id,
        priority: (PRIORITIES.includes(item.priority ?? "") ? item.priority : "P1") as "P1",
        assigned_agent: owner?.id ?? null,
        created_by_agent: melania?.id ?? null,
        status: "READY" as const,
        execution_mode: "ASSISTED" as const,
        success_metric: item.success_metric ?? null,
        why_now: item.why_now ?? null,
        next_action: item.next_action ?? null,
        is_today_priority: true,
        today_date: today,
        trace_id: traceId,
      });
      void i;
    }

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
        .single();

      if (dec.requires_approval && inserted?.id) {
        await db.from("approvals").insert({
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
        });
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
      .eq("id", meeting.id);

    await db.from("activity_logs").insert({
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
    });

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
      .eq("id", meeting.id);
    await db.from("activity_logs").insert({
      organization_id: orgId,
      actor_type: "system",
      action: "meeting.failed",
      entity_type: "executive_meeting",
      entity_id: meeting.id,
      detail: { error: message },
      trace_id: traceId,
    });
    throw err;
  }
}
