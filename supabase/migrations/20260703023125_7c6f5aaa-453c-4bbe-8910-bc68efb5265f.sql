
-- Todos
CREATE TABLE public.agent_project_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.agent_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_project_todos TO authenticated;
GRANT SELECT ON public.agent_project_todos TO anon;
GRANT ALL ON public.agent_project_todos TO service_role;
ALTER TABLE public.agent_project_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos service role" ON public.agent_project_todos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "todos public read" ON public.agent_project_todos FOR SELECT USING (true);
CREATE INDEX idx_agent_project_todos_project ON public.agent_project_todos(project_id);

-- Notes / News
CREATE TABLE public.agent_project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.agent_projects(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_project_notes TO authenticated;
GRANT SELECT ON public.agent_project_notes TO anon;
GRANT ALL ON public.agent_project_notes TO service_role;
ALTER TABLE public.agent_project_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes service role" ON public.agent_project_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "notes public read" ON public.agent_project_notes FOR SELECT USING (true);
CREATE INDEX idx_agent_project_notes_project ON public.agent_project_notes(project_id);

-- Members (partners in a project). References pennyekart_agents (must be a registered samrambhaka user via agent_auth)
CREATE TABLE public.agent_project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.agent_projects(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_project_members TO authenticated;
GRANT SELECT ON public.agent_project_members TO anon;
GRANT ALL ON public.agent_project_members TO service_role;
ALTER TABLE public.agent_project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members service role" ON public.agent_project_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "members public read" ON public.agent_project_members FOR SELECT USING (true);
CREATE INDEX idx_agent_project_members_project ON public.agent_project_members(project_id);

-- updated_at triggers reusing existing update_updated_at()
CREATE TRIGGER trg_agent_project_todos_updated BEFORE UPDATE ON public.agent_project_todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_agent_project_notes_updated BEFORE UPDATE ON public.agent_project_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
