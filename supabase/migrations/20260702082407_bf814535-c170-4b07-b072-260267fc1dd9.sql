GRANT SELECT ON public.districts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;

CREATE POLICY "Service role manages districts" ON public.districts FOR ALL TO service_role USING (true) WITH CHECK (true);