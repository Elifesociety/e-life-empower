CREATE TABLE public.department_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  assigned_agent_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by_member_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Department tasks viewable by everyone"
ON public.department_tasks FOR SELECT TO public USING (true);

CREATE POLICY "Super admin manages dept tasks"
ON public.department_tasks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_department_tasks_agent ON public.department_tasks(assigned_agent_id);
CREATE INDEX idx_department_tasks_dept ON public.department_tasks(department_id);