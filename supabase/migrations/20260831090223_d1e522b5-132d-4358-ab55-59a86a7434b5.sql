CREATE TYPE public.lead_phase AS ENUM ('FASE_0_14','FASE_15_45','FASE_46_90');
CREATE TYPE public.lead_status AS ENUM ('NUEVO','CONTACTADO','CALIFICADO','NEGOCIACION','GANADO','PERDIDO','DESCARTADO');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  source text,
  cohort text NOT NULL DEFAULT 'LUXIA',
  interest text,
  zone text,
  budget numeric,
  currency text NOT NULL DEFAULT 'USD',
  phase public.lead_phase NOT NULL DEFAULT 'FASE_0_14',
  status public.lead_status NOT NULL DEFAULT 'NUEVO',
  score integer NOT NULL DEFAULT 0,
  notes text,
  owner_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_agent uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_members" ON public.leads FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "leads_insert_writers" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.can_write(organization_id));
CREATE POLICY "leads_update_writers" ON public.leads FOR UPDATE TO authenticated USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));
CREATE POLICY "leads_delete_admins" ON public.leads FOR DELETE TO authenticated USING (public.can_admin(organization_id));

CREATE TRIGGER set_updated_at_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX leads_org_phase_idx ON public.leads (organization_id, phase, status);

CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  actor_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_agent uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_value text,
  to_value text,
  note text,
  trace_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_events_select_members" ON public.lead_events FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "lead_events_insert_writers" ON public.lead_events FOR INSERT TO authenticated WITH CHECK (public.can_write(organization_id));

CREATE INDEX lead_events_lead_idx ON public.lead_events (lead_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;