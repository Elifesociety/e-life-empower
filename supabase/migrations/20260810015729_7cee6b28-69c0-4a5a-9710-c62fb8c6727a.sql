DROP POLICY IF EXISTS "Current and future notes are viewable" ON public.panchayath_notes;
CREATE POLICY "Notes are viewable by everyone" ON public.panchayath_notes FOR SELECT USING (true);