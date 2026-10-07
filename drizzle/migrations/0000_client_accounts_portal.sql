ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS decisions_client_id_idx ON public.decisions(client_id);
CREATE INDEX IF NOT EXISTS approvals_client_id_idx ON public.approvals(client_id);

CREATE TABLE public.client_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access TO authenticated;
GRANT ALL ON public.client_portal_access TO service_role;
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpa_admin_all ON public.client_portal_access FOR ALL TO authenticated
  USING (app_private.can_admin(organization_id)) WITH CHECK (app_private.can_admin(organization_id));
CREATE POLICY cpa_self_select ON public.client_portal_access FOR SELECT TO authenticated
  USING (revoked_at IS NULL AND lower(email) = lower(coalesce(auth.jwt()->>'email','')));