-- REVIEW ONLY: do not apply to production before Preview validation.
-- Canonical Supabase project: fotlgptsjnhmkgjgrzxv
-- Generated from the live grants/RLS audit on 2026-09-01.
--
-- Purpose:
-- 1. Remove Data API access from anon for internal Command Center tables.
-- 2. Remove TRUNCATE/REFERENCES/TRIGGER and broad DELETE privileges from authenticated.
-- 3. Preserve tenant-scoped RLS as the authorization layer.
--
-- This file intentionally lives under supabase/review, not supabase/migrations:
-- the Supabase CLI is unavailable in the execution environment, so no migration
-- filename/history entry is fabricated.

begin;

revoke all on table
  public.tenants,
  public.tenant_members,
  public.agents,
  public.agent_runs,
  public.tasks,
  public.decisions,
  public.approvals,
  public.meeting_runs,
  public.automation_logs
from anon;

revoke all on table
  public.tenants,
  public.tenant_members,
  public.agents,
  public.agent_runs,
  public.tasks,
  public.decisions,
  public.approvals,
  public.meeting_runs,
  public.automation_logs
from authenticated;

grant select on table
  public.tenants,
  public.tenant_members,
  public.agents,
  public.agent_runs,
  public.tasks,
  public.decisions,
  public.approvals,
  public.meeting_runs,
  public.automation_logs
to authenticated;

grant update (status, completed_at, updated_at)
  on public.tasks to authenticated;

grant update (status, decided_by, decided_at, decision_note, updated_at)
  on public.approvals to authenticated;

grant update (state, decided_by, decided_at, execution_state, executed_at, updated_at)
  on public.decisions to authenticated;

-- Agent configuration is restricted by the existing owner/admin RLS policy.
grant insert, update on public.agents to authenticated;

-- RLS must remain enabled on every Data API table.
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.decisions enable row level security;
alter table public.approvals enable row level security;
alter table public.meeting_runs enable row level security;
alter table public.automation_logs enable row level security;

commit;
