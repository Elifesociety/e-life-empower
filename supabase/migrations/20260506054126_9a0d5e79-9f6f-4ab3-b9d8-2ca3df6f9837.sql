
-- Departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments viewable by everyone" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Super admin manages departments" ON public.departments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Department members (linked to pennyekart_agents)
CREATE TABLE public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  pin_hash text NOT NULL,
  member_role text NOT NULL DEFAULT 'staff',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, agent_id)
);
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department members viewable by everyone" ON public.department_members FOR SELECT USING (true);
CREATE POLICY "Super admin manages department members" ON public.department_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Department work logs
CREATE TABLE public.department_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.department_members(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  work_details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department work logs viewable by everyone" ON public.department_work_logs FOR SELECT USING (true);
CREATE POLICY "Super admin manages dept work logs" ON public.department_work_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_dept_logs_date ON public.department_work_logs (work_date DESC);
CREATE INDEX idx_dept_logs_dept ON public.department_work_logs (department_id);
CREATE INDEX idx_dept_members_agent ON public.department_members (agent_id);

-- Updated_at triggers
CREATE TRIGGER tg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tg_dept_members_updated BEFORE UPDATE ON public.department_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tg_dept_logs_updated BEFORE UPDATE ON public.department_work_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
