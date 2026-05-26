ALTER TABLE public.revision_items
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS chapter_id uuid,
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS revision_items_user_question_uniq
  ON public.revision_items(user_id, question_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exam_date date;