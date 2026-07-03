
CREATE TABLE public.samrambhaka_budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  own_share NUMERIC NOT NULL DEFAULT 0,
  elife_share NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.samrambhaka_budget_plans TO authenticated, anon;
GRANT ALL ON public.samrambhaka_budget_plans TO service_role;

ALTER TABLE public.samrambhaka_budget_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active budget plans"
  ON public.samrambhaka_budget_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages budget plans"
  ON public.samrambhaka_budget_plans FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_samrambhaka_budget_plans_updated_at
  BEFORE UPDATE ON public.samrambhaka_budget_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.samrambhaka_budget_plans (key, label, own_share, elife_share, sort_order) VALUES
  ('own_100', 'Own 100% : e-Life 0%', 100, 0, 1),
  ('80_20', 'Own 80% : e-Life 20%', 80, 20, 2),
  ('50_50', 'Own 50% : e-Life 50%', 50, 50, 3),
  ('20_80', 'Own 20% : e-Life 80%', 20, 80, 4),
  ('samrambhini', 'സംരംഭിനി (0 investment)', 0, 0, 5);
