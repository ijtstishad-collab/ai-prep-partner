
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'general';
