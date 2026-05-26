
ALTER TABLE public.past_questions
  ADD COLUMN IF NOT EXISTS explanation_en text,
  ADD COLUMN IF NOT EXISTS common_mistake text,
  ADD COLUMN IF NOT EXISTS why_a_wrong text,
  ADD COLUMN IF NOT EXISTS why_b_wrong text,
  ADD COLUMN IF NOT EXISTS why_c_wrong text,
  ADD COLUMN IF NOT EXISTS why_d_wrong text,
  ADD COLUMN IF NOT EXISTS formula_or_rule text,
  ADD COLUMN IF NOT EXISTS group_type text,
  ADD COLUMN IF NOT EXISTS appeared_years integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS appeared_boards text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS frequency_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_past_questions_verification ON public.past_questions (verification_status);
CREATE INDEX IF NOT EXISTS idx_past_questions_chapter_verif ON public.past_questions (chapter_id, verification_status);
