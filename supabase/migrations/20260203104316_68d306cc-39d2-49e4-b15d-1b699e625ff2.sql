-- Create enum for Pennyekart agent roles
CREATE TYPE public.pennyekart_agent_role AS ENUM ('team_leader', 'coordinator', 'group_leader', 'pro');

-- Create pennyekart_agents table
CREATE TABLE public.pennyekart_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  role pennyekart_agent_role NOT NULL,
  panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id),
  ward TEXT NOT NULL,
  parent_agent_id UUID REFERENCES public.pennyekart_agents(id),
  customer_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  
  -- Constraint: Only PROs can have customer_count > 0
  CONSTRAINT pro_customer_count CHECK (
    (role = 'pro' AND customer_count >= 0) OR 
    (role != 'pro' AND customer_count = 0)
  )
);

-- Enable RLS
ALTER TABLE public.pennyekart_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Pennyekart agents viewable by authenticated users"
ON public.pennyekart_agents
FOR SELECT
USING (true);

CREATE POLICY "Super admin can manage all pennyekart agents"
ON public.pennyekart_agents
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage pennyekart agents"
ON public.pennyekart_agents
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create index for faster hierarchy queries
CREATE INDEX idx_pennyekart_agents_parent ON public.pennyekart_agents(parent_agent_id);
CREATE INDEX idx_pennyekart_agents_panchayath ON public.pennyekart_agents(panchayath_id);
CREATE INDEX idx_pennyekart_agents_role ON public.pennyekart_agents(role);
CREATE INDEX idx_pennyekart_agents_mobile ON public.pennyekart_agents(mobile);

-- Trigger for updated_at
CREATE TRIGGER update_pennyekart_agents_updated_at
BEFORE UPDATE ON public.pennyekart_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();