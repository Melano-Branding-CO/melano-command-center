# MELANIA Client Integration Guide

**Repo:** melano-command-center  
**API Provider:** melano-control-center (Supabase Edge Functions)  
**Status:** Ready for integration  

---

## What is MELANIA

MELANIA is a multi-tenant decision platform that handles:
- Event ingestion (business triggers, anomalies)
- Decision proposal (AI + policies)
- Outcome recording (metrics, revenue delta)
- Full audit trail

This guide explains how to **consume** MELANIA's `melania-runtime` Edge Function from this command center app.

---

## Prerequisites

- Valid Supabase JWT (from melano-control-center auth)
- Active tenant membership
- Network access to melano-control-center Supabase project

---

## API Endpoints

All requests go to:
```
POST https://[supabase-project-id].supabase.co/functions/v1/melania-runtime
```

**Headers:**
```
Authorization: Bearer [JWT]
Content-Type: application/json
```

---

## Actions

### 1. Ingest Event

Send a business event for processing.

**Request:**
```json
{
  "action": "ingest_event",
  "event_type": "revenue_anomaly",
  "entity_id": "client-123",
  "priority": "high",
  "data": {
    "anomaly_percentage": 45,
    "baseline_revenue": 10000,
    "current_revenue": 14500
  }
}
```

**Response (201):**
```json
{
  "ok": true,
  "event_id": "evt_abc123",
  "tenant_id": "tnt_xyz789",
  "status": "received",
  "created_at": "2026-09-04T10:30:00Z"
}
```

**Error (400/401):**
```json
{
  "ok": false,
  "error": "invalid_token",
  "message": "Authorization header missing or invalid"
}
```

---

### 2. Propose Decision

Ask MELANIA to propose a decision based on an event.

**Request:**
```json
{
  "action": "propose_decision",
  "event_id": "evt_abc123",
  "decision_code": "APPROVE_TRANSACTION",
  "context": {
    "client_lifetime_value": 50000,
    "transaction_amount": 1500,
    "risk_score": 0.2
  }
}
```

**Response (201):**
```json
{
  "ok": true,
  "decision_id": "dec_xyz456",
  "event_id": "evt_abc123",
  "code": "APPROVE_TRANSACTION",
  "execution": "not_executed",
  "requires_approval": true,
  "confidence": 0.95,
  "risk_level": "low",
  "created_at": "2026-09-04T10:31:00Z"
}
```

---

### 3. Trace (Get Full Context)

Retrieve complete trace of an event → decision → outcome.

**Request:**
```json
{
  "action": "trace",
  "event_id": "evt_abc123"
}
```

**Response (200):**
```json
{
  "ok": true,
  "event": {
    "id": "evt_abc123",
    "type": "revenue_anomaly",
    "status": "processed",
    "created_at": "2026-09-04T10:30:00Z"
  },
  "decision": {
    "id": "dec_xyz456",
    "code": "APPROVE_TRANSACTION",
    "execution": "not_executed",
    "confidence": 0.95,
    "created_at": "2026-09-04T10:31:00Z"
  },
  "outcome": null
}
```

Once outcome is recorded:
```json
{
  "outcome": {
    "id": "out_def789",
    "success": true,
    "metric_value": 1500,
    "currency": "ARS",
    "verified_at": "2026-09-04T10:35:00Z"
  }
}
```

---

### 4. Record Outcome

Close the loop: record what actually happened after the decision.

**Request:**
```json
{
  "action": "record_outcome",
  "decision_id": "dec_xyz456",
  "success": true,
  "metric_value": 1500,
  "currency": "ARS",
  "notes": "Transaction approved and completed successfully"
}
```

**Response (201):**
```json
{
  "ok": true,
  "outcome_id": "out_def789",
  "decision_id": "dec_xyz456",
  "success": true,
  "verified_at": "2026-09-04T10:35:00Z"
}
```

---

## TypeScript Client Example

```typescript
// utils/melania.ts
type MelaniaAction = 'ingest_event' | 'propose_decision' | 'trace' | 'record_outcome';

interface MelaniaRequest {
  action: MelaniaAction;
  [key: string]: any;
}

interface MelaniaResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

export async function callMelania(
  jwt: string,
  request: MelaniaRequest
): Promise<MelaniaResponse> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not configured');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/melania-runtime`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok && response.status !== 201) {
    throw new Error(`Melania error: ${response.statusText}`);
  }

  return response.json();
}

// Usage in a React component
async function handleAnomalyDetected(clientId: string, anomaly: number) {
  const jwt = getAuthToken(); // from Supabase auth context

  // 1. Ingest event
  const eventRes = await callMelania(jwt, {
    action: 'ingest_event',
    event_type: 'revenue_anomaly',
    entity_id: clientId,
    priority: 'high',
    data: { anomaly_percentage: anomaly },
  });

  if (!eventRes.ok) throw new Error(eventRes.error);
  const eventId = eventRes.event_id;

  // 2. Propose decision
  const decisionRes = await callMelania(jwt, {
    action: 'propose_decision',
    event_id: eventId,
    decision_code: 'REVIEW_REQUIRED',
  });

  if (!decisionRes.ok) throw new Error(decisionRes.error);
  const decisionId = decisionRes.decision_id;

  // 3. Show decision to user
  console.log(`Decision ${decisionId} proposed. Awaiting approval.`);

  // 4. Record outcome (after human approval)
  const outcomeRes = await callMelania(jwt, {
    action: 'record_outcome',
    decision_id: decisionId,
    success: userApproved,
    metric_value: anomaly,
  });

  // 5. Get full trace
  const traceRes = await callMelania(jwt, {
    action: 'trace',
    event_id: eventId,
  });

  console.log('Full trace:', traceRes);
}
```

---

## Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `missing_token` | No Authorization header |
| 401 | `invalid_token` | JWT expired or malformed |
| 404 | `tenant_not_found` | User not in any active tenant |
| 403 | `tenant_inactive` | Tenant subscription expired |
| 400 | `invalid_action` | Action not recognized |
| 400 | `event_not_found` | Event ID doesn't exist or belongs to different tenant |

---

## Deployment Status

- **Command Center (this repo):** Current version
- **Control Center (MELANIA source):** Branch `claude/desplegar-melania-host-6e06gq`
  - Status: Ready for Release Gate (staging → production)
  - Deployment docs: [MELANIA_DEPLOYMENT.md](../../MELANIA_DEPLOYMENT.md)
  - Release checklist: [MELANIA_DEPLOYMENT_CHECKLIST.md](../../docs/MELANIA_DEPLOYMENT_CHECKLIST.md)

---

## Integration Readiness Checklist

- [ ] MELANIA v1 deployed to staging
- [ ] Smoke tests passing (event → decision → outcome)
- [ ] RLS validation: Tenant A cannot see Tenant B data
- [ ] JWT verification active on Edge Function
- [ ] Command Center JWT generation verified
- [ ] Integration tests written (see test examples above)
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Performance baseline established (p95 < 500ms)

---

## Next Steps

1. Wait for MELANIA deployment to production (branch: `claude/desplegar-melania-host-6e06gq`)
2. Implement TypeScript client (utils/melania.ts)
3. Add integration tests
4. Deploy command center updates
5. Monitor end-to-end flow

---

**Questions?** See MELANIA_PRODUCTION_CORE_V1.md in melano-control-center for full technical spec.
