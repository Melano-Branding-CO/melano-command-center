CREATE POLICY "clients_select_owner_operator" ON public.clients
FOR SELECT TO authenticated
USING (app_private.org_role(organization_id) = 'OPERATOR' AND owner_user = auth.uid());

CREATE POLICY "clients_update_owner_operator" ON public.clients
FOR UPDATE TO authenticated
USING (app_private.org_role(organization_id) = 'OPERATOR' AND owner_user = auth.uid())
WITH CHECK (app_private.org_role(organization_id) = 'OPERATOR' AND owner_user = auth.uid());

CREATE INDEX IF NOT EXISTS clients_owner_user_idx ON public.clients (organization_id, owner_user);