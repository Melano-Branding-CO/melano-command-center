-- Prompts are global operational instructions, not tenant-scoped application data.
-- Keep them accessible only to trusted server-side callers (for example service_role).

alter table public.prompts enable row level security;

revoke all on table public.prompts from anon, authenticated;

drop policy if exists prompts_no_direct_api_access on public.prompts;
create policy prompts_no_direct_api_access
  on public.prompts
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
