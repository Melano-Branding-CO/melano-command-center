-- 1. Private schema for RLS helper functions (not exposed to the API)
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.org_role(_org uuid)
returns public.app_role language sql stable security definer set search_path to 'public'
as $$ select m.role from public.organization_members m where m.organization_id = _org and m.user_id = auth.uid() limit 1; $$;

create or replace function app_private.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.organization_members m where m.organization_id = _org and m.user_id = auth.uid()); $$;

create or replace function app_private.can_write(_org uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select app_private.org_role(_org) in ('CEO','ADMIN','OPERATOR'); $$;

create or replace function app_private.can_admin(_org uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select app_private.org_role(_org) in ('CEO','ADMIN'); $$;

revoke all on function app_private.org_role(uuid), app_private.is_org_member(uuid), app_private.can_write(uuid), app_private.can_admin(uuid) from public, anon;
grant execute on function app_private.org_role(uuid), app_private.is_org_member(uuid), app_private.can_write(uuid), app_private.can_admin(uuid) to authenticated, service_role;

-- 2. Rewrite every policy to use the private helpers
do $$
declare
  r record; q text; w text; roles text; cmd text; stmt text;
begin
  for r in
    select p.polname, c.relname,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as wcheck,
           p.polcmd,
           coalesce((select string_agg(quote_ident(pg_get_userbyid(oid)), ', ') from unnest(p.polroles) as oid where oid <> 0), 'public') as roles
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  loop
    q := r.qual; w := r.wcheck;
    if q is not null then
      q := regexp_replace(q, '(?<![.\w])(public\.)?(can_write|can_admin|is_org_member|org_role)\(', 'app_private.\2(', 'g');
    end if;
    if w is not null then
      w := regexp_replace(w, '(?<![.\w])(public\.)?(can_write|can_admin|is_org_member|org_role)\(', 'app_private.\2(', 'g');
    end if;
    if q is not distinct from r.qual and w is not distinct from r.wcheck then
      continue;
    end if;
    cmd := case r.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end;
    execute format('drop policy %I on public.%I', r.polname, r.relname);
    stmt := format('create policy %I on public.%I for %s to %s', r.polname, r.relname, cmd, r.roles);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- 3. Remove the public (API-exposed) SECURITY DEFINER helpers
drop function if exists public.can_write(uuid);
drop function if exists public.can_admin(uuid);
drop function if exists public.is_org_member(uuid);
drop function if exists public.org_role(uuid);

-- 4. Invite-gated membership instead of automatic org join
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'OPERATOR',
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create unique index if not exists organization_invites_org_email_idx
  on public.organization_invites (organization_id, lower(email)) where accepted_at is null;

grant select, insert, update, delete on public.organization_invites to authenticated;
grant all on public.organization_invites to service_role;
alter table public.organization_invites enable row level security;

drop policy if exists organization_invites_select on public.organization_invites;
create policy organization_invites_select on public.organization_invites for select to authenticated
  using (app_private.can_admin(organization_id));
drop policy if exists organization_invites_insert on public.organization_invites;
create policy organization_invites_insert on public.organization_invites for insert to authenticated
  with check (app_private.can_admin(organization_id));
drop policy if exists organization_invites_update on public.organization_invites;
create policy organization_invites_update on public.organization_invites for update to authenticated
  using (app_private.can_admin(organization_id)) with check (app_private.can_admin(organization_id));
drop policy if exists organization_invites_delete on public.organization_invites;
create policy organization_invites_delete on public.organization_invites for delete to authenticated
  using (app_private.can_admin(organization_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare inv record;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  -- Membership is granted ONLY through an explicit, unexpired invitation.
  select * into inv
  from public.organization_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at asc
  limit 1;

  if inv.id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (inv.organization_id, new.id, inv.role)
    on conflict (organization_id, user_id) do nothing;

    update public.organization_invites
      set accepted_at = now(), accepted_by = new.id
      where id = inv.id;
  end if;

  return new;
end; $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;