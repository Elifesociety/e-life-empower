
CREATE TABLE public.agent_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.pennyekart_agents(id) ON DELETE CASCADE,
  mobile text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_auth_mobile ON public.agent_auth(mobile);

GRANT ALL ON public.agent_auth TO service_role;

ALTER TABLE public.agent_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages agent_auth"
  ON public.agent_auth
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_agent_auth_updated_at
  BEFORE UPDATE ON public.agent_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
