-- Add phone column to admins table for phone-based login
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create index for phone lookup
CREATE INDEX IF NOT EXISTS idx_admins_phone ON public.admins(phone) WHERE phone IS NOT NULL;