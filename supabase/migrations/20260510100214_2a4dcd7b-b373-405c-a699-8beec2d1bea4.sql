
CREATE TABLE public.department_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'planning',
  created_by_member_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department plans viewable by everyone" ON public.department_plans FOR SELECT USING (true);
CREATE POLICY "Super admin manages dept plans" ON public.department_plans FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE INDEX idx_department_plans_dept ON public.department_plans(department_id);

CREATE TABLE public.department_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by_member_id uuid,
  created_by_member_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department todos viewable by everyone" ON public.department_todos FOR SELECT USING (true);
CREATE POLICY "Super admin manages dept todos" ON public.department_todos FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE INDEX idx_department_todos_dept ON public.department_todos(department_id);
