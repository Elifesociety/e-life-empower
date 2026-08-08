ALTER TABLE public.agent_projects ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "Public read samrambhaka logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-media' AND (storage.foldername(name))[1] = 'samrambhaka-logos');

CREATE POLICY "Anyone can upload samrambhaka logos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'program-media' AND (storage.foldername(name))[1] = 'samrambhaka-logos');