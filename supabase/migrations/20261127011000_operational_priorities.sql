-- Manual priorities from current records, without AI or external side effects.
-- SECURITY INVOKER retains the caller's RLS and grants. All writes are one transaction.
CREATE OR REPLACE FUNCTION public.generate_operational_priorities(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_day date;
  v_timezone text;
  v_deadline timestamptz;
  v_trace uuid := gen_random_uuid();
  v_total integer;
  v_created integer := 0;
  v_id uuid;
  candidate record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_organization_id AND m.user_id = auth.uid()
      AND m.role::text IN ('CEO', 'ADMIN', 'OPERATOR')
  ) THEN
    RAISE EXCEPTION 'DENIED: sin permisos para operar esta organización' USING ERRCODE = '42501';
  END IF;

  SELECT timezone INTO STRICT v_timezone FROM public.organizations WHERE id = p_organization_id;
  v_day := (now() AT TIME ZONE v_timezone)::date;
  v_deadline := ((v_day + 1)::timestamp AT TIME ZONE v_timezone) - interval '1 minute';
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || ':' || v_day::text, 0));

  SELECT count(*) INTO v_total FROM public.tasks
    WHERE organization_id = p_organization_id AND is_today_priority AND today_date = v_day AND NOT is_demo;

  FOR candidate IN
    WITH candidates AS (
      SELECT 'task'::text AS source_type, t.id AS source_id, 0 AS rank,
        t.created_at AS due, 'Desbloquear: ' || t.title AS title,
        coalesce(nullif(t.error, ''), nullif(t.why_now, ''), 'Tarea bloqueada en el registro actual.') AS why,
        coalesce(nullif(t.next_action, ''), 'Identificar la causa y registrar la resolución del bloqueo.') AS action,
        coalesce(nullif(t.success_metric, ''), 'Bloqueo resuelto y estado de la tarea actualizado.') AS metric,
        t.assigned_user AS owner_user, t.assigned_agent AS owner_agent, t.client_id, '/tasks'::text AS path
      FROM public.tasks t
      WHERE t.organization_id = p_organization_id AND NOT t.is_demo AND t.status = 'BLOCKED'
      UNION ALL
      SELECT 'lead', l.id, 1, l.next_follow_up_at, 'Retomar seguimiento: ' || l.full_name,
        'Seguimiento vencido desde ' || l.next_follow_up_at::text,
        'Revisar el lead y registrar la próxima acción y fecha de seguimiento. El contacto requiere una acción humana.',
        'Una actividad registrada y próxima fecha de seguimiento actualizada.',
        l.owner_user, NULL::uuid, NULL::uuid, '/leads'
      FROM public.leads l
      WHERE l.organization_id = p_organization_id AND NOT l.is_demo
        AND l.status::text NOT IN ('GANADO', 'PERDIDO', 'DESCARTADO') AND l.next_follow_up_at <= now()
      UNION ALL
      SELECT 'client', c.id, 2, coalesce(c.next_follow_up_at, c.created_at), 'Definir próxima acción: ' || c.name,
        'Cuenta sin próxima acción o con seguimiento vencido. Estado registrado: ' || c.status,
        'Definir y guardar una próxima acción comercial con fecha de seguimiento en Clientes.',
        'Próxima acción y fecha de seguimiento registradas para esta cuenta.',
        c.owner_user, NULL::uuid, c.id, '/clientes'
      FROM public.clients c
      WHERE c.organization_id = p_organization_id AND NOT c.is_demo AND c.status IN ('ACTIVO', 'PROSPECTO')
        AND (nullif(btrim(c.next_action), '') IS NULL OR c.next_follow_up_at <= now())
    )
    SELECT * FROM candidates ORDER BY rank, due, source_id
  LOOP
    EXIT WHEN v_total >= 3;
    -- Deterministic primary key prevents repeat creation by organization/day/source.
    v_id := md5(p_organization_id::text || ':' || v_day::text || ':' || candidate.source_type || ':' || candidate.source_id::text)::uuid;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = v_id) THEN CONTINUE; END IF;
    INSERT INTO public.tasks (id, organization_id, title, description, priority, status, execution_mode,
      assigned_user, assigned_agent, client_id, created_by, deadline, success_metric, why_now, next_action,
      is_today_priority, today_date, trace_id, is_demo)
    VALUES (v_id, p_organization_id, candidate.title,
      jsonb_build_object('mode', 'rules', 'source_type', candidate.source_type, 'source_id', candidate.source_id,
        'source_path', candidate.path)::text,
      CASE WHEN candidate.rank = 0 THEN 'P0'::public.priority_level ELSE 'P1'::public.priority_level END,
      'READY', 'MANUAL', candidate.owner_user, candidate.owner_agent, candidate.client_id, auth.uid(), v_deadline,
      candidate.metric, candidate.why, candidate.action, true, v_day, v_trace, false);
    INSERT INTO public.activity_logs (organization_id, actor_type, actor_user, action, entity_type, entity_id, detail, trace_id)
    VALUES (p_organization_id, 'human', auth.uid(), 'priority.generated_by_rules', 'task', v_id,
      jsonb_build_object('source_type', candidate.source_type, 'source_id', candidate.source_id, 'day', v_day), v_trace);
    v_created := v_created + 1;
    v_total := v_total + 1;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'total', v_total, 'trace_id', v_trace, 'day', v_day);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_operational_priorities(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_operational_priorities(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
