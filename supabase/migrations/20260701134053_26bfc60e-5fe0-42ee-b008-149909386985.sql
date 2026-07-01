
CREATE TABLE public.agent_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  plan_description text,
  model text NOT NULL CHECK (model IN ('individual','partnership','group')),
  entity text NOT NULL CHECK (entity IN ('own_company','elife_affiliated')),
  budget_plan text NOT NULL CHECK (budget_plan IN ('own_100','80_20','50_50','20_80','samrambhini')),
  own_share integer NOT NULL DEFAULT 100,
  elife_share integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.agent_projects TO service_role;

ALTER TABLE public.agent_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages agent_projects"
  ON public.agent_projects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_agent_projects_updated_at
  BEFORE UPDATE ON public.agent_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_agent_projects_agent_id ON public.agent_projects(agent_id);
