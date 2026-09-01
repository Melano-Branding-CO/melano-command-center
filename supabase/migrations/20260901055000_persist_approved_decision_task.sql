-- P0: an APPROVED decision must never be persisted without its operational task.
-- Service-role callers use this function so decision + task + log are one transaction.

create or replace function public.persist_approved_decision_task(
  p_tenant_id uuid,
  p_decision_id text,
  p_title text,
  p_priority text,
  p_action_type text,
  p_owner_agent_id text,
  p_due_at timestamptz,
  p_trace_id uuid,
  p_meeting_run_id uuid,
  p_fields jsonb,
  p_task_payload jsonb,
  p_canonical_key text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  if p_priority not in ('P0', 'P1', 'P2', 'P3') then
    raise exception 'invalid priority: %', p_priority;
  end if;

  if p_priority in ('P0', 'P1') and p_due_at is null then
    raise exception 'P0/P1 decisions require due_at';
  end if;

  if p_priority in ('P0', 'P1') and p_owner_agent_id is null then
    raise exception 'P0/P1 decisions require owner_agent_id';
  end if;

  insert into public.decisions (
    id,
    tenant_id,
    priority,
    title,
    state,
    owner,
    decided_at,
    fields,
    meeting_run_id,
    trace_id,
    approval_required,
    risk_level,
    action_type,
    execution_state
  ) values (
    p_decision_id,
    p_tenant_id,
    p_priority,
    p_title,
    'approved',
    p_owner_agent_id,
    now(),
    coalesce(p_fields, '{}'::jsonb),
    p_meeting_run_id,
    p_trace_id,
    false,
    nullif(p_fields->>'risk_level', ''),
    p_action_type,
    'queued'
  )
  on conflict (tenant_id, id) do update set
    priority = excluded.priority,
    title = excluded.title,
    state = 'approved',
    owner = excluded.owner,
    fields = excluded.fields,
    meeting_run_id = excluded.meeting_run_id,
    trace_id = excluded.trace_id,
    approval_required = false,
    action_type = excluded.action_type,
    execution_state = case
      when public.decisions.execution_state = 'executed' then public.decisions.execution_state
      else 'queued'
    end,
    updated_at = now();

  insert into public.tasks (
    tenant_id,
    meeting_run_id,
    trace_id,
    rank,
    priority,
    title,
    description,
    status,
    owner_agent_id,
    action_type,
    requires_approval,
    payload,
    due_at,
    canonical_key,
    source_decision_id
  ) values (
    p_tenant_id,
    p_meeting_run_id,
    p_trace_id,
    null,
    p_priority,
    p_title,
    nullif(p_task_payload->>'description', ''),
    'pending',
    p_owner_agent_id,
    p_action_type,
    false,
    coalesce(p_task_payload, '{}'::jsonb),
    p_due_at,
    p_canonical_key,
    p_decision_id
  )
  on conflict (tenant_id, canonical_key)
    where canonical_key is not null
      and upper(status) not in ('DONE', 'CANCELLED', 'FAILED')
  do update set
    meeting_run_id = excluded.meeting_run_id,
    trace_id = excluded.trace_id,
    priority = excluded.priority,
    title = excluded.title,
    description = excluded.description,
    owner_agent_id = excluded.owner_agent_id,
    action_type = excluded.action_type,
    payload = excluded.payload,
    due_at = excluded.due_at,
    source_decision_id = excluded.source_decision_id,
    updated_at = now()
  returning id into v_task_id;

  update public.decisions
  set task_id = v_task_id,
      execution_state = 'queued',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_decision_id;

  insert into public.automation_logs (
    tenant_id,
    trace_id,
    meeting_run_id,
    task_id,
    decision_id,
    event_type,
    actor_type,
    actor_id,
    status,
    message,
    payload
  ) values (
    p_tenant_id,
    p_trace_id,
    p_meeting_run_id,
    v_task_id,
    p_decision_id,
    'decision.task.persisted',
    'system',
    'melania',
    'success',
    'Approved decision persisted atomically with task',
    jsonb_build_object('canonical_key', p_canonical_key, 'priority', p_priority)
  );

  return v_task_id;
end;
$$;

revoke all on function public.persist_approved_decision_task(uuid,text,text,text,text,text,timestamptz,uuid,uuid,jsonb,jsonb,text) from public;
grant execute on function public.persist_approved_decision_task(uuid,text,text,text,text,text,timestamptz,uuid,uuid,jsonb,jsonb,text) to service_role;
