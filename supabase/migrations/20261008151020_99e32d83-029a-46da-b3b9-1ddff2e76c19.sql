CREATE TABLE public.deleted_agents_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  agent_name text,
  agent_mobile text,
  agent_role text,
  agent_data jsonb NOT NULL,
  related_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  child_agent_ids uuid[] NOT NULL DEFAULT '{}',
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.deleted_agents_archive TO service_role;
ALTER TABLE public.deleted_agents_archive ENABLE ROW LEVEL SECURITY;