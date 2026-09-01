CREATE TABLE public.annual_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  leads_target integer NOT NULL DEFAULT 0,
  approvals_target integer NOT NULL DEFAULT 0,
  contracts_target integer NOT NULL DEFAULT 0,
  mrr_target numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_goals TO authenticated;
GRANT ALL ON public.annual_goals TO service_role;

ALTER TABLE public.annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_goals_select_members" ON public.annual_goals
  FOR SELECT TO authenticated
  USING (app_private.is_org_member(organization_id));

CREATE POLICY "annual_goals_insert_admin" ON public.annual_goals
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_admin(organization_id));

CREATE POLICY "annual_goals_update_admin" ON public.annual_goals
  FOR UPDATE TO authenticated
  USING (app_private.can_admin(organization_id))
  WITH CHECK (app_private.can_admin(organization_id));

CREATE POLICY "annual_goals_delete_admin" ON public.annual_goals
  FOR DELETE TO authenticated
  USING (app_private.can_admin(organization_id));

CREATE TRIGGER set_updated_at_annual_goals
  BEFORE UPDATE ON public.annual_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();