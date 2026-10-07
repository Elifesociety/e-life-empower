CREATE TABLE public.agent_custom_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  member_agent_id uuid NOT NULL REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  parent_member_agent_id uuid REFERENCES public.pennyekart_agents(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_agent_id, member_agent_id)
);
GRANT ALL ON public.agent_custom_team TO service_role;
ALTER TABLE public.agent_custom_team ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_agent_custom_team_updated BEFORE UPDATE ON public.agent_custom_team FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();