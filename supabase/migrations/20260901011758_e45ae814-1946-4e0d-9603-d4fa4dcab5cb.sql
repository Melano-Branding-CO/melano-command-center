create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  contact_name text,
  email text,
  phone text,
  website text,
  city text,
  segment text,
  status text not null default 'PROSPECTO',
  luxia_stage lead_phase not null default 'FASE_0_14',
  plan text,
  mrr numeric not null default 0,
  currency text not null default 'ARS',
  owner_user uuid references auth.users(id) on delete set null,
  next_action text,
  onboarding_at timestamptz,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_org_idx on public.clients(organization_id);

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

alter table public.clients enable row level security;

create policy "clients_select_admin" on public.clients
  for select to authenticated
  using (app_private.can_admin(organization_id));

create policy "clients_insert_admin" on public.clients
  for insert to authenticated
  with check (app_private.can_admin(organization_id));

create policy "clients_update_admin" on public.clients
  for update to authenticated
  using (app_private.can_admin(organization_id))
  with check (app_private.can_admin(organization_id));

create policy "clients_delete_admin" on public.clients
  for delete to authenticated
  using (app_private.can_admin(organization_id));

create trigger set_updated_at_clients
  before update on public.clients
  for each row execute function public.set_updated_at();