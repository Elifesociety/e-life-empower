-- 1. Dynamic agent roles table
CREATE TABLE public.pennyekart_agent_roles (
  key text PRIMARY KEY,
  name text NOT NULL,
  name_ml text,
  parent_key text REFERENCES public.pennyekart_agent_roles(key) ON UPDATE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pennyekart_agent_roles TO anon;
GRANT SELECT ON public.pennyekart_agent_roles TO authenticated;
GRANT ALL ON public.pennyekart_agent_roles TO service_role;

ALTER TABLE public.pennyekart_agent_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles are readable by everyone"
  ON public.pennyekart_agent_roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Seed the 5 system roles with their hierarchy links
INSERT INTO public.pennyekart_agent_roles (key, name, parent_key, sort_order, is_system, is_active) VALUES
  ('super_admin_partner', 'Super Admin / Business Partner', NULL, 1, true, true),
  ('team_leader', 'Team Leader', NULL, 2, true, true),
  ('coordinator', 'Coordinator', 'team_leader', 3, true, true),
  ('group_leader', 'Group Leader', 'coordinator', 4, true, true),
  ('pro', 'PRO', 'group_leader', 5, true, true);

CREATE TRIGGER trg_agent_roles_updated
  BEFORE UPDATE ON public.pennyekart_agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Convert agents.role from enum to text referencing the new table
ALTER TABLE public.pennyekart_agents DROP CONSTRAINT IF EXISTS pro_customer_count;

ALTER TABLE public.pennyekart_agents
  ALTER COLUMN role TYPE text USING role::text;

ALTER TABLE public.pennyekart_agents
  ADD CONSTRAINT fk_pennyekart_agents_role
  FOREIGN KEY (role) REFERENCES public.pennyekart_agent_roles(key);

-- 4. Enforce customer_count rule via trigger (works for any leaf role)
CREATE OR REPLACE FUNCTION public.enforce_customer_count_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  is_leaf boolean;
BEGIN
  IF NEW.is_active IS DISTINCT FROM false OR TG_OP <> 'UPDATE' THEN
    SELECT NOT EXISTS (SELECT 1 FROM public.pennyekart_agent_roles r WHERE r.parent_key = NEW.role)
    INTO is_leaf;
    IF is_leaf THEN
      IF NEW.customer_count IS NULL OR NEW.customer_count < 0 THEN
        RAISE EXCEPTION 'Leaf roles need a customer count of 0 or more';
      END IF;
    ELSE
      IF NEW.customer_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'Only leaf roles can carry a customer count';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_enforce_customer_count
  BEFORE INSERT OR UPDATE ON public.pennyekart_agents
  FOR EACH ROW
  WHEN (NEW.is_active IS NOT FALSE)
  EXECUTE FUNCTION public.enforce_customer_count_rule();

-- 5. Drop the now-unused enum type
DROP TYPE public.pennyekart_agent_role;
