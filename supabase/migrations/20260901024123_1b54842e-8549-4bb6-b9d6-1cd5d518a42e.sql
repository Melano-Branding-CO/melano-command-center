ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_user uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_assigned_user_idx ON public.tasks (assigned_user);

DROP POLICY IF EXISTS "tasks_update_assignee" ON public.tasks;
CREATE POLICY "tasks_update_assignee" ON public.tasks
FOR UPDATE TO authenticated
USING (assigned_user = auth.uid())
WITH CHECK (assigned_user = auth.uid());