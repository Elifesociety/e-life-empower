CREATE TABLE public.panchayath_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panchayath_id uuid NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  note text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  author_name text,
  author_mobile text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.panchayath_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panchayath_notes TO authenticated;
GRANT ALL ON public.panchayath_notes TO service_role;

ALTER TABLE public.panchayath_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Current and future notes are viewable"
ON public.panchayath_notes FOR SELECT
USING (note_date >= CURRENT_DATE);

CREATE POLICY "Anyone can add a note for today"
ON public.panchayath_notes FOR INSERT
WITH CHECK (note_date >= CURRENT_DATE);

CREATE POLICY "Only today's notes can be edited"
ON public.panchayath_notes FOR UPDATE
USING (note_date = CURRENT_DATE)
WITH CHECK (note_date >= CURRENT_DATE);

CREATE POLICY "Only today's notes can be deleted"
ON public.panchayath_notes FOR DELETE
USING (note_date = CURRENT_DATE);

CREATE INDEX idx_panchayath_notes_pid_date ON public.panchayath_notes (panchayath_id, note_date DESC);

CREATE TRIGGER trg_panchayath_notes_updated_at
BEFORE UPDATE ON public.panchayath_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();