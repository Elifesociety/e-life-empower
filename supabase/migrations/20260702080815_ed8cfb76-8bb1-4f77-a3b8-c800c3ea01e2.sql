
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state, name)
);

GRANT SELECT ON public.districts TO anon, authenticated;
GRANT ALL ON public.districts TO service_role;

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Districts are viewable by everyone"
  ON public.districts FOR SELECT
  USING (true);

INSERT INTO public.districts (state, name)
VALUES ('Kerala', 'Malappuram')
ON CONFLICT (state, name) DO NOTHING;

UPDATE public.panchayaths
SET state = 'Kerala', district = 'Malappuram'
WHERE state IS DISTINCT FROM 'Kerala' OR district IS DISTINCT FROM 'Malappuram';
