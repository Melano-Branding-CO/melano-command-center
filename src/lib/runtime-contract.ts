import { z } from "zod";

export const EvidenceStatusSchema = z.enum([
  "VERIFIED",
  "MISSING",
  "INFERRED",
  "STALE",
  "CONTRADICTED",
]);

export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const EvidenceValueSchema = z.object({
  value: z.unknown().nullable(),
  evidence_status: EvidenceStatusSchema,
  source: z.string().nullable().default(null),
  captured_at: z.string().datetime({ offset: true }).nullable().default(null),
});

export const ProblemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  impact: z.string().optional(),
  evidence_status: EvidenceStatusSchema.default("INFERRED"),
});

export const OpportunitySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  impact: z.string().optional(),
  evidence_status: EvidenceStatusSchema.default("INFERRED"),
});

export const ProposedActionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  owner_agent_id: z.string().nullable().default(null),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  // The model may describe urgency but the backend owns the actual due_at.
  due_at: z.string().datetime({ offset: true }).nullable().default(null),
  success_metric: z.string().nullable().default(null),
  action_type: z.string().default("review"),
  requires_approval: z.boolean().default(false),
  // Accepted only for compatibility; the backend always recomputes this key.
  canonical_key: z.string().nullable().default(null),
});

export const AgentOutputSchema = z.object({
  situation: z.string(),
  changes: z.string(),
  problems: z.array(ProblemSchema),
  opportunities: z.array(OpportunitySchema),
  metrics: z.record(EvidenceValueSchema),
  proposed_action: ProposedActionSchema.nullable(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export function parseAgentOutput(value: unknown): AgentOutput {
  const parsed = AgentOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`FAILED_VALIDATION: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

export type DeadlineStatus = "NO_DEADLINE" | "OPEN" | "OVERDUE";

export function deadlineStatus(dueAt: string | null | undefined, now = new Date()): DeadlineStatus {
  if (!dueAt) return "NO_DEADLINE";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) throw new Error("Invalid due_at");
  return now.getTime() > due.getTime() ? "OVERDUE" : "OPEN";
}

export function canonicalTaskKey(input: {
  tenantId: string;
  actionType: string;
  title: string;
}): string {
  const slug = input.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${input.actionType}:${input.tenantId}:${slug}`;
}

export function asDisplayText(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export const RUNTIME_TIMEZONE = "America/Argentina/Buenos_Aires";
export const CANONICAL_TENANT_SLUG = "melano-inc";
