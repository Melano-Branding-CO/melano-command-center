// Server-only: canonical MELANIA runtime over tenant_id / meeting_runs / automation_logs.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json as DbJson } from "@/integrations/supabase/types";
import {
  CANONICAL_TENANT_SLUG,
  RUNTIME_TIMEZONE,
  canonicalTaskKey,
  deadlineStatus,
  parseAgentOutput,
  type AgentOutput,
} from "@/lib/runtime-contract";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const COST_PER_1K_TOKENS = 0.0003;

export type Json = DbJson;
export type AiResult = {
  text: string;
  tokens: number;
  model: string;
  ms: number;
  structuredMode: "json_schema" | "prompt_fallback";
};

type RuntimeDb = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

const db = supabaseAdmin as unknown as RuntimeDb;

const AGENT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["situation", "changes", "problems", "opportunities", "metrics", "proposed_action"],
  properties: {
    situation: { type: "string" },
    changes: { type: "string" },
    problems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "evidence_status"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "string" },
          evidence_status: {
            type: "string",
            enum: ["VERIFIED", "MISSING", "INFERRED", "STALE", "CONTRADICTED"],
          },
        },
      },
    },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "evidence_status"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "string" },
          evidence_status: {
            type: "string",
            enum: ["VERIFIED", "MISSING", "INFERRED", "STALE", "CONTRADICTED"],
          },
        },
      },
    },
    metrics: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["value", "evidence_status", "source", "captured_at"],
        properties: {
          value: {},
          evidence_status: {
            type: "string",
            enum: ["VERIFIED", "MISSING", "INFERRED", "STALE", "CONTRADICTED"],
          },
          source: { type: ["string", "null"] },
          captured_at: { type: ["string", "null"] },
        },
      },
    },
    proposed_action: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
            "owner_agent_id",
            "priority",
            "due_at",
            "success_metric",
            "action_type",
            "requires_approval",
            "canonical_key",
          ],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            owner_agent_id: { type: ["string", "null"] },
            priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
            due_at: { type: ["string", "null"] },
            success_metric: { type: ["string", "null"] },
            action_type: { type: "string" },
            requires_approval: { type: "boolean" },
            canonical_key: { type: ["string", "null"] },
          },
        },
      ],
    },
  },
} as const;

const BriefStatementSchema = z.object({
  statement: z.string().min(1),
  kind: z.enum(["HECHO", "SUPUESTO", "PENDIENTE", "BLOQUEO"]),
});

const TopItemSchema = z.object({
  title: z.string().min(1),
  why_now: z.string().min(1),
  next_action: z.string().min(1),
  success_metric: z.string().min(1),
  owner_code: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  action_type: z.string().min(1),
  requires_approval: z.boolean(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
});

const ConsolidationSchema = z.object({
  summary: z.string().min(1),
  brief: z.array(BriefStatementSchema),
  contradictions: z.array(z.string()),
  top3: z.array(TopItemSchema).max(3),
});

type Consolidation = z.infer<typeof ConsolidationSchema>;

const CONSOLIDATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "brief", "contradictions", "top3"],
  properties: {
    summary: { type: "string" },
    brief: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "kind"],
        properties: {
          statement: { type: "string" },
          kind: { type: "string", enum: ["HECHO", "SUPUESTO", "PENDIENTE", "BLOQUEO"] },
        },
      },
    },
    contradictions: { type: "array", items: { type: "string" } },
    top3: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "why_now",
          "next_action",
          "success_metric",
          "owner_code",
          "priority",
          "action_type",
          "requires_approval",
          "risk_level",
        ],
        properties: {
          title: { type: "string" },
          why_now: { type: "string" },
          next_action: { type: "string" },
          success_metric: { type: "string" },
          owner_code: { type: "string" },
          priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
          action_type: { type: "string" },
          requires_approval: { type: "boolean" },
          risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
      },
    },
  },
} as const;

const AGENT_PROFILES: Record<
  string,
  { code: string; role: string; objective: string; instructions: string }
> = {
  "ag-cro": {
    code: "CRO",
    role: "Chief Revenue Officer",
    objective: "Detectar bloqueos y palancas materiales de revenue, MRR, pipeline y conversión.",
    instructions: "Priorizá LUXIA, pipeline real y cobros. No proyectes revenue sin evidencia verificable.",
  },
  "ag-cfo": {
    code: "CFO",
    role: "Chief Financial Officer",
    objective: "Evaluar caja, MRR, gastos, clientes pagos y riesgos financieros con evidencia.",
    instructions: "Si una cifra no está en las fuentes, marcala MISSING. Nunca reemplaces faltantes por cero.",
  },
  "ag-coo": {
    code: "COO",
    role: "Chief Operating Officer",
    objective: "Detectar trabajo estancado, falta de dueño, dependencias y problemas de ejecución.",
    instructions: "No confundas APPROVED con ejecutado. Exigí evidencia de persistencia y logs.",
  },
  "ag-cpo": {
    code: "CTO_PRODUCT",
    role: "CPO/CTO",
    objective: "Evaluar producto, arquitectura, seguridad y Green Gate sobre evidencia funcional.",
    instructions: "No declares GREEN por build, preview o HTTP aislado. UNKNOWN no equivale a FAILED.",
  },
  "ag-risk": {
    code: "QA",
    role: "QA / Auditor",
    objective: "Auditar contradicciones, evidencia, permisos, trazabilidad y cierres falsos.",
    instructions: "Ausencia de evidencia no es evidencia de ausencia. No propongas DELETE por falta de contexto.",
  },
  "ag-chair": {
    code: "MELANIA",
    role: "Orquestador ejecutivo",
    objective: "Consolidar el comité en máximo tres prioridades verificables.",
    instructions: "Separá HECHO, SUPUESTO, PENDIENTE y BLOQUEO. No inventes estado operativo.",
  },
};

const CORE_SPECIALISTS = ["ag-cro", "ag-cfo", "ag-coo", "ag-cpo", "ag-risk"];

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("FAILED_VALIDATION: respuesta sin JSON");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw new Error(
      `FAILED_VALIDATION: JSON inválido (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function requestAi(
  system: string,
  user: string,
  jsonSchema?: { name: string; schema: unknown },
): Promise<AiResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Falta LOVABLE_API_KEY en el servidor");

  const makeBody = (withSchema: boolean) => ({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(withSchema && jsonSchema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: jsonSchema.name,
              strict: true,
              schema: jsonSchema.schema,
            },
          },
        }
      : {}),
  });

  const t0 = Date.now();
  let structuredMode: AiResult["structuredMode"] = "json_schema";
  let res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(makeBody(true)),
  });

  // Provider compatibility fallback is explicit; runtime validation remains mandatory.
  if (!res.ok && res.status === 400 && jsonSchema) {
    structuredMode = "prompt_fallback";
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(makeBody(false)),
    });
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Límite de uso de IA alcanzado");
    if (res.status === 402) throw new Error("Sin créditos de IA disponibles");
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    tokens: data.usage?.total_tokens ?? 0,
    model: MODEL,
    ms: Date.now() - t0,
    structuredMode,
  };
}

function localTime(now: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: RUNTIME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

function metricEvidence(value: unknown, capturedAt?: string | null) {
  if (value === null || value === undefined || String(value).trim() === "") return "MISSING";
  if (!capturedAt) return "VERIFIED";
  const ageMs = Date.now() - new Date(capturedAt).getTime();
  return ageMs > 7 * 86_400_000 ? "STALE" : "VERIFIED";
}

async function loadTenantContext(tenantId: string) {
  const now = new Date();
  const [tasks, decisions, approvals, kpis, criticalActions, luxiaHealth, mrr, pipeline, systems] =
    await Promise.all([
      db
        .from("tasks")
        .select("id,title,status,priority,due_at,owner_agent_id,action_type,payload,updated_at")
        .eq("tenant_id", tenantId)
        .not("status", "in", "(done,cancelled)")
        .order("updated_at", { ascending: false })
        .limit(40),
      db
        .from("decisions")
        .select("id,title,state,priority,owner,execution_state,approval_required,risk_level,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(20),
      db
        .from("approvals")
        .select("id,decision_id,action_type,risk_level,reason,status,requested_at")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(20),
      db.from("kpi_snapshot").select("key,label,value,tone,updated_at").eq("tenant_id", tenantId),
      db
        .from("critical_actions")
        .select("id,priority,title,owner,status,fields,updated_at")
        .eq("tenant_id", tenantId)
        .is("resolved_at", null)
        .limit(20),
      db.from("luxia_health").select("id,status,fields,updated_at").eq("tenant_id", tenantId),
      db.from("mrr_snapshot").select("id,headline,mrr_value,fields,updated_at").eq("tenant_id", tenantId),
      db
        .from("pipeline_snapshot")
        .select("id,health,total_value,deal_count,fields,updated_at")
        .eq("tenant_id", tenantId),
      db
        .from("system_status")
        .select("id,service,state,latency_ms,alert,checked_at,updated_at")
        .eq("tenant_id", tenantId),
    ]);

  const queries = [tasks, decisions, approvals, kpis, criticalActions, luxiaHealth, mrr, pipeline, systems];
  const failed = queries.find((query) => query.error);
  if (failed?.error) throw new Error(`Context load failed: ${failed.error.message}`);

  return JSON.stringify(
    {
      current_time: {
        utc: now.toISOString(),
        local: localTime(now),
        timezone: RUNTIME_TIMEZONE,
      },
      tasks: (tasks.data ?? []).map((task: Record<string, unknown>) => ({
        ...task,
        deadline_status: deadlineStatus(task["due_at"] as string | null, now),
      })),
      decisions: decisions.data ?? [],
      pending_approvals: approvals.data ?? [],
      metrics: (kpis.data ?? []).map((row: Record<string, unknown>) => ({
        key: row["key"],
        label: row["label"],
        value: row["value"],
        evidence_status: metricEvidence(row["value"], row["updated_at"] as string | null),
        source: "kpi_snapshot",
        captured_at: row["updated_at"],
      })),
      critical_actions: criticalActions.data ?? [],
      products: {
        LUXIA: (luxiaHealth.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          evidence_status: "VERIFIED",
          source: "luxia_health",
        })),
      },
      financial_snapshots: {
        mrr: (mrr.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          evidence_status: metricEvidence(row["mrr_value"], row["updated_at"] as string | null),
          source: "mrr_snapshot",
        })),
        pipeline: (pipeline.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          evidence_status: metricEvidence(row["total_value"], row["updated_at"] as string | null),
          source: "pipeline_snapshot",
        })),
      },
      system_status: systems.data ?? [],
      evidence_rule:
        "VERIFIED only when a concrete source row is present. Missing source rows must remain MISSING, never zero.",
    },
    null,
    2,
  ).slice(0, 18000);
}

export async function resolveOrgId(orgId?: string): Promise<string> {
  if (orgId) {
    const { data, error } = await db.from("tenants").select("id").eq("id", orgId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Tenant no encontrado");
    return data.id as string;
  }

  const { data, error } = await db
    .from("tenants")
    .select("id")
    .eq("slug", CANONICAL_TENANT_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error(`No existe tenant canónico ${CANONICAL_TENANT_SLUG}`);
  return data.id as string;
}

type CanonicalAgent = {
  id: string;
  tenant_id: string;
  name: string;
  state: string;
  error_count: number;
};

export function buildAgentPrompt(agent: CanonicalAgent, _toolNames: string[] = []): string {
  const profile = AGENT_PROFILES[agent.id] ?? {
    code: agent.id.toUpperCase(),
    role: agent.name,
    objective: "Analizar exclusivamente la evidencia provista.",
    instructions: "No inventes datos ni estados.",
  };

  return `Sos ${profile.code} — ${profile.role} de MELANO INC.

Objetivo: ${profile.objective}
${profile.instructions}

REGLAS OBLIGATORIAS:
- Sólo tratá como HECHO lo presente en las fuentes del contexto.
- Ausencia de evidencia NO es evidencia de ausencia.
- Nunca transformes SIN DATOS/MISSING en cero.
- Los estados temporales deadline_status ya vienen calculados por backend; no recalcules fechas.
- No recomiendes eliminar productos, agentes o datos sólo porque no aparezcan en el contexto.
- Si no agregás información material, usá situation="NO_MATERIAL_DELTA", arrays vacíos y proposed_action=null.
- proposed_action.due_at y canonical_key deben ser null: el backend los calcula.
- Respondé exclusivamente con el objeto JSON solicitado.`;
}

async function createMeetingRun(tenantId: string, trigger: "manual" | "scheduled", traceId: string) {
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: RUNTIME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const idempotencyKey = trigger === "scheduled" ? `executive:${tenantId}:${dateKey}` : null;

  if (idempotencyKey) {
    const { data: existing, error: existingError } = await db
      .from("meeting_runs")
      .select("id,trace_id,status,summary")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { ...existing, reused: true };
  }

  const { data, error } = await db
    .from("meeting_runs")
    .insert({
      tenant_id: tenantId,
      trace_id: traceId,
      idempotency_key: idempotencyKey,
      trigger_source: trigger,
      autonomy_level: 2,
      status: "running",
      scheduled_for: now.toISOString(),
      started_at: now.toISOString(),
      top3_count: 0,
      summary: {},
    })
    .select("id,trace_id,status,summary")
    .single();
  if (error || !data) throw error ?? new Error("No se pudo crear meeting_run");
  return { ...data, reused: false };
}

export async function runAgentServer(agentId: string, meetingId?: string, inheritedTraceId?: string) {
  let tenantId = await resolveOrgId();
  let effectiveMeetingId = meetingId;
  let traceId = inheritedTraceId ?? crypto.randomUUID();
  let ownsMeeting = false;

  if (meetingId) {
    const { data: meeting, error } = await db
      .from("meeting_runs")
      .select("id,tenant_id,trace_id")
      .eq("id", meetingId)
      .single();
    if (error || !meeting) throw error ?? new Error("meeting_run no encontrado");
    tenantId = meeting.tenant_id as string;
    traceId = inheritedTraceId ?? (meeting.trace_id as string);
  } else {
    const meeting = await createMeetingRun(tenantId, "manual", traceId);
    effectiveMeetingId = meeting.id as string;
    traceId = meeting.trace_id as string;
    ownsMeeting = true;
  }

  const { data: agent, error: agentError } = await db
    .from("agents")
    .select("id,tenant_id,name,state,error_count")
    .eq("tenant_id", tenantId)
    .eq("id", agentId)
    .maybeSingle();
  if (agentError || !agent) throw agentError ?? new Error("Agente no encontrado en tenant canónico");
  if (["PAUSED", "OFF"].includes(agent.state as string)) throw new Error("Agente pausado");

  const canonicalAgent = agent as CanonicalAgent;
  const context = await loadTenantContext(tenantId);
  const systemPrompt = buildAgentPrompt(canonicalAgent);
  const userPrompt = `Estado canónico de MELANO INC (JSON):\n${context}\n\nAnalizá sólo este contexto.`;

  const { data: run, error: runError } = await db
    .from("agent_runs")
    .insert({
      tenant_id: tenantId,
      meeting_run_id: effectiveMeetingId,
      agent_id: canonicalAgent.id,
      trace_id: traceId,
      status: "running",
      input: {
        model: MODEL,
        agent_code: AGENT_PROFILES[canonicalAgent.id]?.code ?? canonicalAgent.id,
        context_bytes: context.length,
      },
      output: {},
    })
    .select("id")
    .single();
  if (runError || !run) throw runError ?? new Error("No se pudo crear agent_run");

  try {
    const result = await requestAi(systemPrompt, userPrompt, {
      name: "melano_agent_output",
      schema: AGENT_RESPONSE_JSON_SCHEMA,
    });
    const raw = extractJson(result.text);
    const parsed = parseAgentOutput(raw);

    await db
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output: parsed,
        recommendation: parsed.proposed_action?.title ?? null,
      })
      .eq("id", run.id);

    await db
      .from("agents")
      .update({ state: "ACTIVE", last_run_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", canonicalAgent.id);

    await db.from("automation_logs").insert({
      tenant_id: tenantId,
      trace_id: traceId,
      meeting_run_id: effectiveMeetingId,
      agent_run_id: run.id,
      event_type: "agent.run.completed",
      actor_type: "agent",
      actor_id: canonicalAgent.id,
      status: "success",
      message: "Agent output validated and persisted",
      payload: {
        model: result.model,
        tokens: result.tokens,
        duration_ms: result.ms,
        estimated_cost: Number(((result.tokens / 1000) * COST_PER_1K_TOKENS).toFixed(6)),
        structured_mode: result.structuredMode,
      },
    });

    if (ownsMeeting) {
      await db
        .from("meeting_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          summary: { summary: `Ejecución manual de ${canonicalAgent.name}`, agent_run_id: run.id },
        })
        .eq("id", effectiveMeetingId);
    }

    return { agent: canonicalAgent, parsed, traceId, runId: run.id as string, tokens: result.tokens };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const eventType = message.startsWith("FAILED_VALIDATION")
      ? "agent.run.failed_validation"
      : "agent.run.failed";

    await db
      .from("agent_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error: message })
      .eq("id", run.id);

    await db
      .from("agents")
      .update({ state: "ERROR", error_count: Number(canonicalAgent.error_count ?? 0) + 1 })
      .eq("tenant_id", tenantId)
      .eq("id", canonicalAgent.id);

    await db.from("automation_logs").insert({
      tenant_id: tenantId,
      trace_id: traceId,
      meeting_run_id: effectiveMeetingId,
      agent_run_id: run.id,
      event_type: eventType,
      actor_type: "agent",
      actor_id: canonicalAgent.id,
      status: "error",
      message,
      payload: {},
    });

    if (ownsMeeting) {
      await db
        .from("meeting_runs")
        .update({ status: "failed", completed_at: new Date().toISOString(), error: message })
        .eq("id", effectiveMeetingId);
    }
    throw error;
  }
}

function dueAtFor(priority: "P0" | "P1" | "P2" | "P3", now = new Date()) {
  const ms = priority === "P0" ? 24 * 3600_000 : priority === "P1" ? 72 * 3600_000 : 7 * 86_400_000;
  if (priority === "P3") return null;
  return new Date(now.getTime() + ms).toISOString();
}

async function persistTopItem(args: {
  tenantId: string;
  meetingId: string;
  traceId: string;
  item: z.infer<typeof TopItemSchema>;
  ownerId: string;
}) {
  const { tenantId, meetingId, traceId, item, ownerId } = args;
  const canonicalKey = canonicalTaskKey({
    tenantId,
    actionType: item.action_type,
    title: item.title,
  });
  const decisionId = `runtime:${canonicalKey}`;
  const dueAt = dueAtFor(item.priority);
  const fields = {
    description: item.why_now,
    reasoning_summary: item.next_action,
    expected_impact: item.success_metric,
    risk: item.risk_level,
    source_agent: "ag-chair",
  };
  const taskPayload = {
    description: item.why_now,
    why_now: item.why_now,
    next_action: item.next_action,
    success_metric: item.success_metric,
    is_today_priority: true,
    today_date: new Intl.DateTimeFormat("en-CA", { timeZone: RUNTIME_TIMEZONE }).format(new Date()),
  };

  if (item.requires_approval) {
    const { error: decisionError } = await db.from("decisions").upsert(
      {
        id: decisionId,
        tenant_id: tenantId,
        priority: item.priority,
        title: item.title,
        state: "pending",
        owner: ownerId,
        fields,
        meeting_run_id: meetingId,
        trace_id: traceId,
        approval_required: true,
        risk_level: item.risk_level,
        action_type: item.action_type,
        execution_state: "awaiting_approval",
      },
      { onConflict: "tenant_id,id" },
    );
    if (decisionError) throw decisionError;

    const { data: existingApproval, error: approvalLookupError } = await db
      .from("approvals")
      .select("id,status")
      .eq("tenant_id", tenantId)
      .eq("decision_id", decisionId)
      .eq("status", "pending")
      .maybeSingle();
    if (approvalLookupError) throw approvalLookupError;

    if (!existingApproval) {
      const { error: approvalError } = await db.from("approvals").insert({
        tenant_id: tenantId,
        decision_id: decisionId,
        trace_id: traceId,
        risk_level: item.risk_level,
        action_type: item.action_type,
        reason: item.why_now,
        status: "pending",
        requested_by_agent: "ag-chair",
        metadata: { action: item.title, category: item.action_type, success_metric: item.success_metric },
      });
      if (approvalError) throw approvalError;
    }

    return {
      decision_id: decisionId,
      task_id: null,
      approval_required: true,
      canonical_key: canonicalKey,
      due_at: dueAt,
      owner_agent_id: ownerId,
    };
  }

  const { data: taskId, error: rpcError } = await db.rpc("persist_approved_decision_task", {
    p_tenant_id: tenantId,
    p_decision_id: decisionId,
    p_title: item.title,
    p_priority: item.priority,
    p_action_type: item.action_type,
    p_owner_agent_id: ownerId,
    p_due_at: dueAt,
    p_trace_id: traceId,
    p_meeting_run_id: meetingId,
    p_fields: fields,
    p_task_payload: taskPayload,
    p_canonical_key: canonicalKey,
  });
  if (rpcError) throw rpcError;

  return {
    decision_id: decisionId,
    task_id: taskId as string,
    approval_required: false,
    canonical_key: canonicalKey,
    due_at: dueAt,
    owner_agent_id: ownerId,
  };
}

/** Reunión ejecutiva: cinco especialistas aportan y MELANIA consolida máximo Top 3. */
export async function runExecutiveMeetingServer(
  opts: { orgId?: string; trigger?: "schedule" | "manual" } = {},
) {
  const tenantId = await resolveOrgId(opts.orgId);
  const traceId = crypto.randomUUID();
  const trigger = opts.trigger === "schedule" ? "scheduled" : "manual";
  const meeting = await createMeetingRun(tenantId, trigger, traceId);

  if (meeting.reused) {
    return {
      meetingId: meeting.id as string,
      traceId: meeting.trace_id as string,
      brief: meeting.summary as Consolidation,
      reused: true,
    };
  }

  const meetingId = meeting.id as string;
  try {
    const { data: agents, error: agentsError } = await db
      .from("agents")
      .select("id,tenant_id,name,state,error_count")
      .eq("tenant_id", tenantId)
      .in("state", ["ACTIVE", "PILOT"]);
    if (agentsError) throw agentsError;

    const available = new Map(
      (agents ?? []).map((agent: CanonicalAgent) => [agent.id, agent] as const),
    );
    const specialistIds = CORE_SPECIALISTS.filter((id) => available.has(id));
    if (specialistIds.length < 3) {
      throw new Error(`Comité insuficiente: ${specialistIds.length}/5 especialistas canónicos disponibles`);
    }

    const results = await Promise.all(
      specialistIds.map(async (agentId) => {
        try {
          const run = await runAgentServer(agentId, meetingId, traceId);
          return {
            code: AGENT_PROFILES[agentId]?.code ?? agentId,
            agent_id: agentId,
            status: "completed",
            output: run.parsed,
          };
        } catch (error) {
          return {
            code: AGENT_PROFILES[agentId]?.code ?? agentId,
            agent_id: agentId,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    const successful = results.filter((result) => result.status === "completed");
    if (successful.length < 3) {
      throw new Error(`Comité sin quorum de evidencia: ${successful.length}/${specialistIds.length}`);
    }

    const ownerCodes = specialistIds.map((id) => AGENT_PROFILES[id]?.code ?? id);
    const chair = available.get("ag-chair") ?? ({
      id: "ag-chair",
      tenant_id: tenantId,
      name: "CHAIR — Orquestador",
      state: "ACTIVE",
      error_count: 0,
    } as CanonicalAgent);
    const chairPrompt = `${buildAgentPrompt(chair)}

CONSOLIDACIÓN:
- Definí máximo 3 prioridades.
- owner_code debe ser uno de: ${ownerCodes.join(", ")}.
- No emitas fechas: backend define due_at.
- P0/P1 deben tener owner_code válido.
- requires_approval=true para producción, seguridad, permisos, borrado, pagos, contratos o envíos externos irreversibles.
- Evitá duplicar el mismo problema con títulos distintos.`;

    const consolidationAi = await requestAi(
      chairPrompt,
      `Aportes validados del comité:\n${JSON.stringify(results).slice(0, 20000)}`,
      { name: "melania_consolidation", schema: CONSOLIDATION_JSON_SCHEMA },
    );
    const consolidationRaw = extractJson(consolidationAi.text);
    const consolidationParsed = ConsolidationSchema.safeParse(consolidationRaw);
    if (!consolidationParsed.success) {
      throw new Error(
        `FAILED_VALIDATION: consolidation ${consolidationParsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }
    const brief = consolidationParsed.data;

    const codeToId = new Map<string, string>();
    for (const id of specialistIds) {
      const code = AGENT_PROFILES[id]?.code;
      if (code) codeToId.set(code.toUpperCase(), id);
    }

    const persistedTop3 = [] as Array<Record<string, unknown>>;
    for (const item of brief.top3) {
      const ownerId = codeToId.get(item.owner_code.toUpperCase());
      if (!ownerId) throw new Error(`FAILED_VALIDATION: owner_code inválido ${item.owner_code}`);
      if (["P0", "P1"].includes(item.priority) && !ownerId) {
        throw new Error(`FAILED_VALIDATION: ${item.priority} sin owner`);
      }
      const persisted = await persistTopItem({ tenantId, meetingId, traceId, item, ownerId });
      persistedTop3.push({ ...item, ...persisted });
    }

    const completedSummary = {
      title: `Reunión ejecutiva ${localTime(new Date()).slice(0, 10)}`,
      summary: brief.summary,
      brief: brief.brief,
      contradictions: brief.contradictions,
      top3: persistedTop3,
      committee: results,
      structured_mode: consolidationAi.structuredMode,
    };

    await db.from("agent_runs").insert({
      tenant_id: tenantId,
      meeting_run_id: meetingId,
      agent_id: "ag-chair",
      trace_id: traceId,
      status: "completed",
      input: { role: "consolidation", model: MODEL },
      output: completedSummary,
      recommendation: brief.summary.slice(0, 500),
      completed_at: new Date().toISOString(),
    });

    await db
      .from("meeting_runs")
      .update({
        status: successful.length === specialistIds.length ? "completed" : "partial",
        completed_at: new Date().toISOString(),
        top3_count: persistedTop3.length,
        summary: completedSummary,
        error:
          successful.length === specialistIds.length
            ? null
            : `${specialistIds.length - successful.length} agent(s) failed`,
      })
      .eq("id", meetingId);

    await db.from("automation_logs").insert({
      tenant_id: tenantId,
      trace_id: traceId,
      meeting_run_id: meetingId,
      event_type: "meeting.completed",
      actor_type: "agent",
      actor_id: "ag-chair",
      status: "success",
      message: "Executive meeting completed with validated Top 3",
      payload: {
        participants: specialistIds.length,
        successful: successful.length,
        top3_count: persistedTop3.length,
      },
    });

    return { meetingId, traceId, brief: completedSummary, reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("meeting_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error: message })
      .eq("id", meetingId);
    await db.from("automation_logs").insert({
      tenant_id: tenantId,
      trace_id: traceId,
      meeting_run_id: meetingId,
      event_type: message.startsWith("FAILED_VALIDATION")
        ? "meeting.failed_validation"
        : "meeting.failed",
      actor_type: "system",
      actor_id: "melania-runtime",
      status: "error",
      message,
      payload: {},
    });
    throw error;
  }
}
