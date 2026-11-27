-- AI meetings share the same per-day lock/cap as rule-generated priorities.
-- Only the trusted server may save model output after authorizing the request.
CREATE OR REPLACE FUNCTION public.save_meeting_priorities(
  p_organization_id uuid, p_meeting_id uuid, p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_day date;
  v_timezone text;
  v_total integer;
  v_deadline timestamptz;
  v_saved jsonb := '[]'::jsonb;
  v_agent uuid;
  v_chair uuid;
  v_trace uuid;
  v_id uuid;
  item record;
BEGIN
  SELECT trace_id INTO STRICT v_trace FROM public.executive_meetings
    WHERE id = p_meeting_id AND organization_id = p_organization_id AND status = 'RUNNING';
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Prioridades inválidas'; END IF;
  SELECT timezone INTO STRICT v_timezone FROM public.organizations WHERE id = p_organization_id;
  SELECT id INTO v_chair FROM public.agents WHERE organization_id = p_organization_id AND code = 'MELANIA' LIMIT 1;
  v_day := (now() AT TIME ZONE v_timezone)::date;
  v_deadline := ((v_day + 1)::timestamp AT TIME ZONE v_timezone) - interval '1 minute';
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || ':' || v_day::text, 0));
  SELECT count(*) INTO v_total FROM public.tasks
    WHERE organization_id = p_organization_id AND is_today_priority AND today_date = v_day AND NOT is_demo;
  FOR item IN SELECT value, ordinality FROM jsonb_array_elements(p_items) WITH ORDINALITY LIMIT 3 LOOP
    EXIT WHEN v_total >= 3;
    IF nullif(btrim(item.value->>'title'), '') IS NULL THEN RAISE EXCEPTION 'Prioridad sin título'; END IF;
    v_id := md5(p_organization_id::text || ':' || v_day::text || ':meeting:' || p_meeting_id::text || ':' || item.ordinality::text)::uuid;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = v_id) THEN CONTINUE; END IF;
    SELECT id INTO v_agent FROM public.agents WHERE organization_id = p_organization_id AND code = upper(item.value->>'owner_code') LIMIT 1;
    INSERT INTO public.tasks (id, organization_id, title, description, meeting_id, priority, assigned_agent,
      created_by_agent, status, execution_mode, deadline, success_metric, why_now, next_action, is_today_priority, today_date, trace_id)
    VALUES (v_id, p_organization_id, item.value->>'title', item.value->>'why_now', p_meeting_id,
      CASE WHEN item.value->>'priority' IN ('P0','P1','P2','P3') THEN (item.value->>'priority')::public.priority_level ELSE 'P1'::public.priority_level END,
      v_agent, v_chair, 'READY', 'ASSISTED', v_deadline, item.value->>'success_metric', item.value->>'why_now', item.value->>'next_action', true, v_day, v_trace);
    INSERT INTO public.activity_logs (organization_id, actor_type, actor_agent, action, entity_type, entity_id, detail, trace_id)
    VALUES (p_organization_id, 'agent', v_chair, 'priority.generated_by_meeting', 'task', v_id,
      jsonb_build_object('meeting_id', p_meeting_id, 'day', v_day), v_trace);
    v_saved := v_saved || jsonb_build_array(item.value);
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('saved_items', v_saved, 'total', v_total, 'day', v_day);
END;
$$;

REVOKE ALL ON FUNCTION public.save_meeting_priorities(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_meeting_priorities(uuid, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
