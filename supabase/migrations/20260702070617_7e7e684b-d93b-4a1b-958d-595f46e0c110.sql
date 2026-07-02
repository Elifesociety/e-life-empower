ALTER TABLE public.agent_direct_customers
  ADD COLUMN IF NOT EXISTS panchayath_id uuid REFERENCES public.panchayaths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_outside boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS agent_direct_customers_agent_outside_idx
  ON public.agent_direct_customers (agent_id, is_outside);