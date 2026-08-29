-- ENUMS
create type public.app_role as enum ('CEO','ADMIN','OPERATOR','VIEWER','AGENT');
create type public.agent_status as enum ('ACTIVE','PAUSED','RUNNING','BLOCKED','ERROR');
create type public.execution_mode as enum ('MANUAL','ASSISTED','AUTONOMOUS','APPROVAL_REQUIRED');
create type public.priority_level as enum ('P0','P1','P2','P3');
create type public.task_status as enum ('BACKLOG','READY','RUNNING','BLOCKED','REVIEW','DONE','FAILED');
create type public.decision_status as enum ('PROPOSED','APPROVED','REJECTED','EXECUTING','COMPLETED','FAILED');
create type public.approval_status as enum ('PENDING','APPROVED','REJECTED');
create type public.meeting_status as enum ('SCHEDULED','RUNNING','COMPLETED','FAILED');
create type public.run_status as enum ('RUNNING','SUCCESS','FAILED','SKIPPED');
create type public.trigger_type as enum ('schedule','database_event','webhook','manual','external_event');
create type public.alert_severity as enum ('CRITICAL','HIGH','MEDIUM','LOW','INFO');
create type public.health_state as enum ('GREEN','YELLOW','RED');

-- CORE
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  tagline text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  autonomy_level int not null default 2,
  system_health public.health_state not null default 'YELLOW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'VIEWER',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m where m.organization_id = _org and m.user_id = auth.uid());
$$;

create or replace function public.org_role(_org uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select m.role from public.organization_members m where m.organization_id = _org and m.user_id = auth.uid() limit 1;
$$;

create or replace function public.can_write(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role(_org) in ('CEO','ADMIN','OPERATOR');
$$;

create or replace function public.can_admin(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role(_org) in ('CEO','ADMIN');
$$;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  role text not null,
  objective text not null,
  system_prompt text not null,
  context text,
  execution_loop text,
  stop_conditions text,
  failure_handling text,
  observability text,
  measurable_outcome text,
  status public.agent_status not null default 'ACTIVE',
  enabled boolean not null default true,
  execution_mode public.execution_mode not null default 'ASSISTED',
  permissions jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_result text,
  last_error text,
  confidence numeric not null default 0.5,
  is_demo boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.agent_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_name text not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  priority public.priority_level not null default 'P2',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  priority public.priority_level not null default 'P2',
  roadmap jsonb not null default '[]'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.executive_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  status public.meeting_status not null default 'SCHEDULED',
  trigger public.trigger_type not null default 'manual',
  trace_id uuid not null default gen_random_uuid(),
  executive_brief jsonb,
  summary text,
  error text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  role_in_meeting text,
  joined_at timestamptz not null default now()
);

create table public.meeting_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  situation text,
  changes text,
  problems text,
  opportunities text,
  metrics jsonb not null default '[]'::jsonb,
  proposed_action text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid references public.executive_meetings(id) on delete set null,
  title text not null,
  description text,
  source_agent uuid references public.agents(id) on delete set null,
  signal text,
  analysis text,
  priority public.priority_level not null default 'P2',
  status public.decision_status not null default 'PROPOSED',
  reasoning_summary text,
  evidence jsonb not null default '[]'::jsonb,
  expected_impact text,
  risk text,
  confidence numeric not null default 0.5,
  requires_approval boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  outcome text,
  outcome_at timestamptz,
  trace_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_id uuid not null references public.decisions(id) on delete cascade,
  label text not null,
  kind text not null default 'HECHO',
  source text,
  content text,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  meeting_id uuid references public.executive_meetings(id) on delete set null,
  decision_id uuid references public.decisions(id) on delete set null,
  priority public.priority_level not null default 'P2',
  assigned_agent uuid references public.agents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_agent uuid references public.agents(id) on delete set null,
  status public.task_status not null default 'BACKLOG',
  execution_mode public.execution_mode not null default 'ASSISTED',
  deadline timestamptz,
  success_metric text,
  why_now text,
  next_action text,
  is_today_priority boolean not null default false,
  today_date date,
  requires_approval boolean not null default false,
  result text,
  error text,
  trace_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  category text not null default 'GENERAL',
  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  decision_id uuid references public.decisions(id) on delete set null,
  reason text,
  impact text,
  risk text,
  evidence jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status public.approval_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  trace_id uuid,
  is_demo boolean not null default false
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger public.trigger_type not null default 'schedule',
  schedule_expression text,
  agent_id uuid references public.agents(id) on delete set null,
  action text not null,
  enabled boolean not null default true,
  status text not null default 'ACTIVE',
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_result text,
  last_error text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.run_status not null default 'RUNNING',
  output text,
  error text,
  trace_id uuid
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  meeting_id uuid references public.executive_meetings(id) on delete set null,
  trigger public.trigger_type not null default 'manual',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.run_status not null default 'RUNNING',
  input jsonb,
  output jsonb,
  tools_used jsonb not null default '[]'::jsonb,
  error text,
  tokens int,
  estimated_cost numeric,
  trace_id uuid
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  message text,
  severity public.alert_severity not null default 'MEDIUM',
  source_agent uuid references public.agents(id) on delete set null,
  status text not null default 'OPEN',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  category text not null default 'GENERAL',
  value numeric not null default 0,
  unit text,
  source_agent uuid references public.agents(id) on delete set null,
  captured_at timestamptz not null default now(),
  is_demo boolean not null default false
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_type text not null default 'SYSTEM',
  actor_agent uuid references public.agents(id) on delete set null,
  actor_user uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now()
);

-- GRANTS + RLS
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_self_select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (id = auth.uid());

grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;
create policy "org_select" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "org_update" on public.organizations for update to authenticated using (public.can_admin(id)) with check (public.can_admin(id));

grant select, insert, update, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;
create policy "members_select" on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy "members_admin_write" on public.organization_members for all to authenticated using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));

do $$
declare t text;
begin
  foreach t in array array['agents','agent_permissions','agent_tools','projects','products','executive_meetings','meeting_participants','meeting_outputs','decisions','decision_evidence','tasks','task_dependencies','approvals','automation_rules','automation_runs','agent_runs','alerts','metrics','activity_logs']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (public.is_org_member(organization_id));', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (public.can_write(organization_id));', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using (public.can_admin(organization_id));', t, t);
  end loop;
end $$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','organizations','agents','projects','products','decisions','tasks','automation_rules']
  loop
    execute format('create trigger set_updated_at_%s before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- new user handling: profile + membership in MELANO INC
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare org_id uuid; member_count int;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  select id into org_id from public.organizations where slug = 'melano-inc' limit 1;
  if org_id is not null then
    select count(*) into member_count from public.organization_members where organization_id = org_id;
    insert into public.organization_members (organization_id, user_id, role)
    values (org_id, new.id, case when member_count = 0 then 'CEO'::public.app_role else 'OPERATOR'::public.app_role end);
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SEED: organization
insert into public.organizations (id, name, slug, tagline, autonomy_level, system_health)
values ('11111111-1111-4111-8111-111111111111','MELANO INC','melano-inc','AI. Automation. Impact.',2,'YELLOW');

-- SEED: agents
insert into public.agents (organization_id, code, name, role, objective, system_prompt, context, execution_loop, stop_conditions, failure_handling, observability, measurable_outcome, execution_mode, sort_order, tools, permissions) values
('11111111-1111-4111-8111-111111111111','MELANIA','MELANIA','Digital CEO / Executive Orchestrator','Coordinar el sistema completo, priorizar y decidir qué agente actúa.','Sos MELANIA, CEO digital de MELANO INC. Recibís el estado de todos los agentes, revisás métricas, detectás bloqueos y contradicciones, ordenás prioridades, decidís qué agente debe actuar, creás tareas y solicitás aprobación humana para acciones críticas o irreversibles. Nunca ejecutás acciones críticas por tu cuenta. Diferenciá siempre HECHO, SUPUESTO, PENDIENTE y BLOQUEO.','Estado consolidado de agentes, métricas, tareas, decisiones y bloqueos de MELANO INC.','OBSERVE -> ANALYZE -> PRIORITIZE -> DECIDE -> ASSIGN -> EXECUTE -> VERIFY -> LEARN','Acción crítica o irreversible; datos insuficientes; contradicción sin resolver.','Registrar error en agent_runs, marcar estado ERROR y escalar a Bruno.','agent_runs + activity_logs + trace_id por ciclo.','Top 3 prioridades diarias con responsables y métricas de éxito.','APPROVAL_REQUIRED',1,'["meeting_orchestration","task_creation","decision_engine"]','["create_tasks","create_decisions","request_approval"]'),
('11111111-1111-4111-8111-111111111111','CRO','CRO','Chief Revenue Officer','Revenue, pipeline, ventas y MRR.','Sos el CRO de MELANO INC. Analizás revenue, pipeline, oportunidades, conversión y MRR. Reportás hechos con números y marcás supuestos.','Pipeline comercial y métricas de revenue.','OBSERVE -> ANALYZE -> PROPOSE','Falta de datos comerciales verificables.','Reportar bloqueo y solicitar datos.','agent_runs + metrics.','MRR y pipeline con variación semanal.','ASSISTED',2,'["crm_read","metrics_read"]','["create_tasks"]'),
('11111111-1111-4111-8111-111111111111','CMO','CMO','Chief Marketing Officer','Growth, campañas, contenido y competencia.','Sos el CMO de MELANO INC. Analizás growth, campañas, contenido y competencia. Nunca lanzás campañas con gasto sin aprobación humana.','Marketing y adquisición.','OBSERVE -> ANALYZE -> PROPOSE','Campañas con gasto real.','Escalar a approval center.','agent_runs + metrics.','CAC, leads y alcance.','ASSISTED',3,'["analytics_read"]','["create_tasks","request_approval"]'),
('11111111-1111-4111-8111-111111111111','COO','COO','Chief Operating Officer','Operaciones, bloqueos y responsables.','Sos el COO de MELANO INC. Detectás bloqueos operativos, dueños faltantes y tareas atascadas.','Operación diaria y tareas.','OBSERVE -> ANALYZE -> UNBLOCK','Bloqueo que requiere decisión humana.','Escalar a MELANIA.','agent_runs + tasks.','Tareas bloqueadas resueltas.','ASSISTED',4,'["tasks_read"]','["create_tasks"]'),
('11111111-1111-4111-8111-111111111111','CTO','CTO','Chief Technology Officer','GitHub, base de datos, deploys y arquitectura.','Sos el CTO de MELANO INC. Analizás arquitectura, deploys, incidentes técnicos y deuda técnica. Cambios de producción requieren aprobación humana.','Infraestructura y producto técnico.','OBSERVE -> ANALYZE -> PROPOSE','Cambios en producción o seguridad.','Escalar a approval center.','agent_runs + activity_logs.','Incidentes abiertos y tiempo de resolución.','APPROVAL_REQUIRED',5,'["repo_read","db_read"]','["create_tasks","request_approval"]'),
('11111111-1111-4111-8111-111111111111','CFO','CFO','Chief Financial Officer','Cashflow, costos y forecasting.','Sos el CFO de MELANO INC. Analizás cashflow, costos, runway y forecast. Ningún pago se ejecuta sin aprobación humana.','Finanzas de la compañía.','OBSERVE -> ANALYZE -> FORECAST','Pagos o compromisos financieros.','Escalar a approval center.','agent_runs + metrics.','Runway y costo mensual.','APPROVAL_REQUIRED',6,'["metrics_read"]','["request_approval"]'),
('11111111-1111-4111-8111-111111111111','PRODUCT','PRODUCT','Head of Product','LUXIA, roadmap y producto.','Sos el responsable de producto de MELANO INC. Priorizás roadmap con foco en LUXIA como SaaS de Real Estate.','Roadmap y productos.','OBSERVE -> ANALYZE -> PRIORITIZE','Cambios de alcance mayores.','Escalar a MELANIA.','agent_runs + products.','Entregables de roadmap completados.','ASSISTED',7,'["products_read"]','["create_tasks"]'),
('11111111-1111-4111-8111-111111111111','LUXIA','LUXIA','Revenue Agent / CRM','Leads, CRM, follow-up y conversión.','Sos LUXIA, agente de leads y CRM. Detectás follow-ups vencidos, leads sin dueño y oportunidades de conversión.','CRM y leads.','OBSERVE -> ANALYZE -> FOLLOW-UP','Comunicaciones críticas con clientes.','Escalar a approval center.','agent_runs + tasks.','Follow-ups al día y tasa de conversión.','ASSISTED',8,'["crm_read"]','["create_tasks","request_approval"]'),
('11111111-1111-4111-8111-111111111111','ALENYA','ALENYA','Knowledge Officer','Knowledge base y documentación.','Sos ALENYA, responsable de la base de conocimiento y documentación de MELANO INC. Detectás documentación faltante o desactualizada.','Documentación interna.','OBSERVE -> ANALYZE -> DOCUMENT','Información sensible.','Reportar bloqueo.','agent_runs + activity_logs.','Cobertura de documentación.','AUTONOMOUS',9,'["docs_read"]','["create_tasks"]'),
('11111111-1111-4111-8111-111111111111','TITAN','TITAN','Financial Analytics','Analytics financiero.','Sos TITAN, analista financiero cuantitativo de MELANO INC. No ejecutás trading real bajo ninguna circunstancia sin aprobación humana.','Analytics financiero.','OBSERVE -> ANALYZE -> REPORT','Trading real o movimientos de capital.','Escalar a approval center.','agent_runs + metrics.','Calidad de forecast.','APPROVAL_REQUIRED',10,'["metrics_read"]','["request_approval"]'),
('11111111-1111-4111-8111-111111111111','NOTORIUS','NOTORIUS','Tokenization & Blockchain','Tokenización y blockchain.','Sos NOTORIUS, responsable de tokenización y blockchain de MELANO INC. Mainnet siempre requiere aprobación humana.','Blockchain y tokenización.','OBSERVE -> ANALYZE -> PROPOSE','Operaciones mainnet.','Escalar a approval center.','agent_runs + activity_logs.','Hitos de tokenización.','APPROVAL_REQUIRED',11,'["chain_read"]','["request_approval"]'),
('11111111-1111-4111-8111-111111111111','QA','QA AUDITOR','QA / Auditor','Evidencia, errores y GREEN Gate.','Sos el QA Auditor de MELANO INC. Verificás evidencia real: trigger real, ejecución real, resultado esperado, persistencia, log y verificación. Sin eso, nada es GREEN.','Evidencia y calidad.','OBSERVE -> VERIFY -> REPORT','Falta de evidencia.','Marcar RED y bloquear.','agent_runs + activity_logs.','Porcentaje de funciones GREEN verificadas.','ASSISTED',12,'["logs_read"]','["create_tasks"]');

-- SEED: products
insert into public.products (organization_id, code, name, description, priority, status) values
('11111111-1111-4111-8111-111111111111','LUXIA','LUXIA','SaaS de Real Estate. Prioridad principal de producto.','P1','ACTIVE'),
('11111111-1111-4111-8111-111111111111','MELANIA','MELANIA','CEO digital y orquestador del sistema autónomo.','P1','ACTIVE'),
('11111111-1111-4111-8111-111111111111','TITAN','TITAN','Analytics financiero.','P2','ACTIVE'),
('11111111-1111-4111-8111-111111111111','NOTORIUS','NOTORIUS','Tokenización y blockchain.','P3','ACTIVE');

-- SEED: automation rule (06:00 meeting)
insert into public.automation_rules (organization_id, name, description, trigger, schedule_expression, action, agent_id, enabled, status)
select '11111111-1111-4111-8111-111111111111','Executive Morning Meeting','Reunión ejecutiva autónoma diaria a las 06:00 America/Argentina/Buenos_Aires.','schedule','0 9 * * *','run_executive_meeting', a.id, true, 'ACTIVE'
from public.agents a where a.code = 'MELANIA' and a.organization_id = '11111111-1111-4111-8111-111111111111';

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.activity_logs;