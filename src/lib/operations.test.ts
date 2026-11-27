import { validateCommercialInput } from "./commercial-input.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertAgentScope,
  assertOperationRole,
  aiConfiguration,
  checked,
} from "./operational-guards.ts";
import { requestAiCompletion } from "./ai-gateway.server.ts";
import { workflowOutcome } from "./n8n-result.ts";
import { summarizeRevenue, type RevenueClient, type RevenueLead } from "./revenue-summary.ts";

const client = (changes: Partial<RevenueClient> = {}): RevenueClient => ({
  id: "client",
  organization_id: "A",
  name: "Cuenta",
  status: "ACTIVO",
  currency: "USD",
  mrr: 100,
  is_demo: false,
  next_action: null,
  next_follow_up_at: null,
  ...changes,
});
const lead = (changes: Partial<RevenueLead> = {}): RevenueLead => ({
  id: "lead",
  organization_id: "A",
  status: "CONTACTADO",
  is_demo: false,
  next_follow_up_at: "2026-11-27T00:00:00Z",
  ...changes,
});

test("revenue separates currencies and excludes prospects, demo and other organizations", () => {
  const result = summarizeRevenue(
    [
      client(),
      client({ currency: "ARS", mrr: 200000 }),
      client({ status: "PROSPECTO", mrr: 8000 }),
      client({ is_demo: true, mrr: 9000 }),
      client({ organization_id: "B", mrr: 9000 }),
      client({ status: "BAJA", mrr: 999 }),
      client({ mrr: -1 }),
    ],
    [],
    "A",
    "2026-11-27T00:30:00Z",
  );
  assert.deepEqual(result.money, [
    { currency: "ARS", mrr: 200000, arr: 2400000 },
    { currency: "USD", mrr: 100, arr: 1200 },
  ]);
  assert.equal(result.prospects, 1);
  assert.equal(result.profitability, null);
  assert.equal(result.payments, null);
});

test("overdue followups use instants and exclude completed, demo and cross-tenant leads", () => {
  const result = summarizeRevenue(
    [],
    [
      lead(),
      lead({ next_follow_up_at: "2026-11-26T23:00:00-03:00" }),
      lead({ status: "GANADO" }),
      lead({ status: "DESCARTADO" }),
      lead({ is_demo: true }),
      lead({ organization_id: "B" }),
    ],
    "A",
    "2026-11-27T00:30:00Z",
  );
  assert.equal(result.pendingFollowups, 1);
  assert.deepEqual(result.money, []);
});

test("VIEWER and missing membership cannot operate; foreign or paused agents are rejected", () => {
  for (const role of [null, undefined, "VIEWER", "AGENT"])
    assert.throws(() => assertOperationRole(role), /DENIED/);
  for (const role of ["CEO", "ADMIN", "OPERATOR"])
    assert.doesNotThrow(() => assertOperationRole(role));
  assert.throws(
    () => assertAgentScope({ organization_id: "B", enabled: true, status: "ACTIVE" }, "A"),
    /DENIED/,
  );
  assert.throws(() => assertAgentScope(null, "A"), /DENIED/);
  assert.throws(
    () => assertAgentScope({ organization_id: "A", enabled: false, status: "PAUSED" }, "A"),
    /pausado/,
  );
  assert.throws(
    () => assertAgentScope({ organization_id: "A", enabled: true, status: "RUNNING" }, "A"),
    /ejecución/,
  );
});

test("missing AI configuration makes zero network calls and cannot imply verified service", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({});
  };
  await assert.rejects(requestAiCompletion("", "", undefined, fetcher), /BLOQUEO/);
  assert.equal(calls, 0);
  assert.deepEqual(aiConfiguration(true).verified, false);
});

test("AI rejects 401/402/429 without retry or provider detail leakage", async () => {
  for (const status of [401, 402, 429]) {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return new Response("private provider error", { status });
    };
    await assert.rejects(
      requestAiCompletion("", "", "test-key", fetcher),
      (error) =>
        error instanceof Error &&
        error.message.includes(`HTTP ${status}`) &&
        !error.message.includes("private"),
    );
    assert.equal(calls, 1);
  }
});

test("AI rejects empty completions and accepts a real nonempty response", async () => {
  await assert.rejects(
    requestAiCompletion("", "", "test-key", async () => Response.json({ choices: [] })),
    /resultado válido/,
  );
  const result = await requestAiCompletion("", "", "test-key", async () =>
    Response.json({ choices: [{ message: { content: "análisis" } }], usage: { total_tokens: 12 } }),
  );
  assert.equal(result.text, "análisis");
  assert.equal(result.tokens, 12);
});

test("persistence errors propagate instead of reporting success", async () => {
  await assert.rejects(
    checked(Promise.resolve({ error: { message: "write rejected" } })),
    /write rejected/,
  );
});

test("n8n HTTP acceptance, queued or failed payloads cannot become success", () => {
  for (const body of [
    "",
    "Workflow was started",
    '{"ok":true}',
    '{"status":"queued","executionId":"1"}',
  ]) {
    assert.equal(workflowOutcome({ ok: true, status: 200, body }).state, "pending");
  }
  assert.equal(
    workflowOutcome({ ok: true, status: 200, body: '{"success":false}' }).state,
    "failed",
  );
  assert.equal(workflowOutcome({ ok: false, status: 503, body: "Unavailable" }).state, "failed");
  assert.equal(
    workflowOutcome({ ok: true, status: 200, body: '{"status":"success","executionId":"123"}' })
      .state,
    "success",
  );
});

test("commercial records require nonnegative money, a supported state and an actionable followup", () => {
  const input = {
    organizationId: "A",
    clientId: "client",
    status: "PROSPECTO",
    currency: "USD",
    mrr: 0,
    nextAction: "  Confirmar diagnóstico  ",
    nextFollowUpAt: "2026-11-27T12:00:00-03:00",
  };
  assert.equal(validateCommercialInput(input).nextFollowUpAt, "2026-11-27T15:00:00.000Z");
  assert.equal(validateCommercialInput(input).nextAction, "Confirmar diagnóstico");
  for (const change of [
    { mrr: -1 },
    { mrr: NaN },
    { currency: "US" },
    { status: "UNKNOWN" },
    { nextAction: " " },
    { nextFollowUpAt: null },
  ]) {
    assert.throws(() => validateCommercialInput({ ...input, ...change }));
  }
});
