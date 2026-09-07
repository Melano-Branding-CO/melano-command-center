-- Revenue Attribution v1
-- Canonical Command Center ledger: lead -> action -> outcome -> sale -> subscription -> MRR -> agent/workflow.
-- Client sessions are read-only; ingestion is reserved to service-role/backend automation.

create table if not exists public.revenue_attribution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_key text not null,
  lead_id text,
  source_action_id text,
  source_outcome_id text,
  subscription_id text,
  trace_id uuid,
  agent_id text,
  workflow_id text,
  workflow_name text,
  automation_mode text not null default 'unknown',
  product text not null default 'luxia',
  event_type text not null,
  action_type text,
  outcome_type text,
  currency text,
  pipeline_amount numeric,
  realized_revenue numeric,
  mrr_amount numeric,
  automation_cost numeric,
  attribution_weight numeric not null default 1,
  confidence numeric not null default 1,
  source_system text not null,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_attribution_events_event_key_uq unique (tenant_id, event_key),
  constraint revenue_attribution_events_weight_ck check (attribution_weight >= 0 and attribution_weight <= 1),
  constraint revenue_attribution_events_confidence_ck check (confidence >= 0 and confidence <= 1),
  constraint revenue_attribution_events_cost_ck check (automation_cost is null or automation_cost >= 0),
  constraint revenue_attribution_events_currency_ck check (currency is null or currency ~ '^[A-Z]{3}$')
);

create index if not exists revenue_attribution_events_tenant_updated_idx
  on public.revenue_attribution_events (tenant_id, updated_at desc);
create index if not exists revenue_attribution_events_tenant_lead_idx
  on public.revenue_attribution_events (tenant_id, lead_id)
  where lead_id is not null;
create index if not exists revenue_attribution_events_tenant_workflow_idx
  on public.revenue_attribution_events (tenant_id, workflow_id)
  where workflow_id is not null;
create index if not exists revenue_attribution_events_tenant_agent_idx
  on public.revenue_attribution_events (tenant_id, agent_id)
  where agent_id is not null;

alter table public.revenue_attribution_events enable row level security;

drop policy if exists revenue_attribution_events_tenant_select on public.revenue_attribution_events;
create policy revenue_attribution_events_tenant_select
  on public.revenue_attribution_events
  for select
  to authenticated
  using ((select private.user_has_tenant_access(tenant_id)));

revoke all on public.revenue_attribution_events from anon;
revoke insert, update, delete on public.revenue_attribution_events from authenticated;
grant select on public.revenue_attribution_events to authenticated;
grant all on public.revenue_attribution_events to service_role;

-- Extend the already-established verified ledger snapshot instead of creating a competing KPI table.
alter table public.revenue_ledger_snapshot
  add column if not exists product text,
  add column if not exists mrr_amount numeric,
  add column if not exists pipeline_amount numeric,
  add column if not exists ai_revenue_amount numeric,
  add column if not exists automation_cost_amount numeric,
  add column if not exists roi_multiple numeric,
  add column if not exists conversion_rate numeric,
  add column if not exists attributed_lead_count integer not null default 0,
  add column if not exists won_count integer not null default 0,
  add column if not exists attribution_status text not null default 'PENDING_EVIDENCE',
  add column if not exists evidence jsonb not null default '{}'::jsonb;

comment on table public.revenue_attribution_events is
  'Auditable revenue lineage by lead, automation/workflow and agent. Service-write, tenant-read.';
comment on column public.revenue_ledger_snapshot.ai_revenue_amount is
  'Revenue counted as AI-attributed only when an attribution event carries explicit AI lineage and economic evidence.';
comment on column public.revenue_ledger_snapshot.automation_cost_amount is
  'Measured automation/AI cost. NULL means cost evidence is unavailable; never infer zero.';
comment on column public.revenue_ledger_snapshot.roi_multiple is
  'Attributed ROI multiple. NULL when automation cost is missing or zero.';
