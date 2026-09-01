-- P0 Command Center runtime contract: task idempotency.
-- This migration is intentionally additive and reversible at the code level.

alter table public.tasks
  add column if not exists canonical_key text,
  add column if not exists source_decision_id text;

create unique index if not exists tasks_one_active_canonical_action
  on public.tasks (tenant_id, canonical_key)
  where canonical_key is not null
    and upper(status) not in ('DONE', 'CANCELLED', 'FAILED');

create index if not exists tasks_source_decision_id_idx
  on public.tasks (tenant_id, source_decision_id)
  where source_decision_id is not null;

comment on column public.tasks.canonical_key is
  'Stable idempotency key for one active logical action per tenant.';

comment on column public.tasks.source_decision_id is
  'Decision that originated or last refreshed this task.';
