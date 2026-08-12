CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_ml text,
  description text,
  cover_url text,
  category text NOT NULL DEFAULT 'General',
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title text NOT NULL,
  lesson_type text NOT NULL DEFAULT 'notes',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_minutes integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  learner_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, learner_key)
);

CREATE INDEX idx_training_lessons_training ON public.training_lessons(training_id);
CREATE INDEX idx_training_progress_learner ON public.training_progress(learner_key);

GRANT SELECT ON public.trainings TO anon;
GRANT SELECT ON public.trainings TO authenticated;
GRANT ALL ON public.trainings TO service_role;

GRANT SELECT ON public.training_lessons TO anon;
GRANT SELECT ON public.training_lessons TO authenticated;
GRANT ALL ON public.training_lessons TO service_role;

GRANT SELECT, INSERT, DELETE ON public.training_progress TO anon;
GRANT SELECT, INSERT, DELETE ON public.training_progress TO authenticated;
GRANT ALL ON public.training_progress TO service_role;

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published public trainings"
ON public.trainings FOR SELECT
USING (is_published AND is_public);

CREATE POLICY "Authenticated can view all trainings"
ON public.trainings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Public can view lessons of published public trainings"
ON public.training_lessons FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trainings t
  WHERE t.id = training_lessons.training_id AND t.is_published AND t.is_public
));

CREATE POLICY "Authenticated can view all lessons"
ON public.training_lessons FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Anyone can read progress"
ON public.training_progress FOR SELECT
USING (true);

CREATE POLICY "Anyone can record progress"
ON public.training_progress FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can remove progress"
ON public.training_progress FOR DELETE
USING (true);

CREATE TRIGGER trg_trainings_updated_at BEFORE UPDATE ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_training_lessons_updated_at BEFORE UPDATE ON public.training_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();