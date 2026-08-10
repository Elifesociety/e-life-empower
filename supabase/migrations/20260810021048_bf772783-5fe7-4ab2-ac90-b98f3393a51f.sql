GRANT ALL ON public.agent_project_todos TO service_role;
GRANT ALL ON public.agent_project_notes TO service_role;
GRANT ALL ON public.agent_project_members TO service_role;
GRANT ALL ON public.agent_projects TO service_role;
GRANT SELECT ON public.agent_project_todos TO anon, authenticated;
GRANT SELECT ON public.agent_project_notes TO anon, authenticated;
GRANT SELECT ON public.agent_project_members TO anon, authenticated;
GRANT SELECT ON public.agent_projects TO anon, authenticated;