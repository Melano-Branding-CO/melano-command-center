-- P0: human approval/rejection + decision/task/log must be atomic.

create or replace function public.resolve_runtime_approval(
  p_approval_id uuid,
  p_approved boolean,
  p_user_id uuid,
  p_note text,
  p_due_at timestamptz,
  p_canonical_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_approval public.approvals%rowtype;
  v_decision public.decisions%rowtype;
  v_task_id uuid;
  v_task_payload jsonb;
begin
  select * into v_approval
  from public.approvals
  where id = p_approval_id
  for update;

  if not found then
    raise exception 'approval not found';
  end if;

  if v_approval.status <> 'pending' then
    raise exception 'approval already resolved: %', v_approval.status;
  end if;

  if v_approval.decision_id is null then
    raise exception 'approval has no decision_id';
  end if;

  select * into v_decision
  from public.decisions
  where tenant_id = v_approval.tenant_id
    and id = v_approval.decision_id
  for update;

  if not found then
    raise exception 'decision not found';
  end if;

  if not p_approved then
    update public.approvals
    set status = 'rejected',
        decided_by = p_user_id,
        decided_at = now(),
        decision_note = p_note,
        updated_at = now()
    where id = p_approval_id;

    update public.decisions
    set state = 'rejected',
        execution_state = 'rejected',
        updated_at = now()
    where tenant_id = v_decision.tenant_id
      and id = v_decision.id;

    insert into public.automation_logs (
      tenant_id, trace_id, decision_id, approval_id,
      event_type, actor_type, actor_id, status, message, payload
    ) values (
      v_approval.tenant_id,
      v_approval.trace_id,
      v_decision.id,
      v_approval.id,
      'approval.rejected',
      'human',
      p_user_id::text,
      'success',
      'Human rejected runtime decision',
      jsonb_build_object('note', p_note)
    );

    return jsonb_build_object('status', 'rejected', 'task_id', null);
  end if;

  v_task_payload := jsonb_build_object(
    'description', coalesce(v_decision.fields->>'description', ''),
    'why_now', coalesce(v_decision.fields->>'description', ''),
    'next_action', coalesce(v_decision.fields->>'reasoning_summary', ''),
    'success_metric', coalesce(v_decision.fields->>'expected_impact', ''),
    'approved_by', p_user_id,
    'approval_id', p_approval_id
  );

  v_task_id := public.persist_approved_decision_task(
    v_decision.tenant_id,
    v_decision.id,
    v_decision.title,
    v_decision.priority,
    coalesce(v_decision.action_type, v_approval.action_type),
    v_decision.owner,
    p_due_at,
    v_approval.trace_id,
    v_decision.meeting_run_id,
    v_decision.fields,
    v_task_payload,
    p_canonical_key
  );

  update public.approvals
  set status = 'approved',
      task_id = v_task_id,
      decided_by = p_user_id,
      decided_at = now(),
      decision_note = p_note,
      updated_at = now()
  where id = p_approval_id;

  insert into public.automation_logs (
    tenant_id, trace_id, meeting_run_id, task_id, decision_id, approval_id,
    event_type, actor_type, actor_id, status, message, payload
  ) values (
    v_approval.tenant_id,
    v_approval.trace_id,
    v_decision.meeting_run_id,
    v_task_id,
    v_decision.id,
    v_approval.id,
    'approval.approved',
    'human',
    p_user_id::text,
    'success',
    'Human approved runtime decision and task was persisted',
    jsonb_build_object('note', p_note, 'canonical_key', p_canonical_key)
  );

  return jsonb_build_object('status', 'approved', 'task_id', v_task_id);
end;
$$;

revoke all on function public.resolve_runtime_approval(uuid,boolean,uuid,text,timestamptz,text) from public;
grant execute on function public.resolve_runtime_approval(uuid,boolean,uuid,text,timestamptz,text) to service_role;
