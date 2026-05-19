-- Starter approved MCQs for the HSC Biology chapter currently being tested in
-- the browser: Cell and its Structure. These are original practice questions,
-- not copied past-board questions.

-- Some dashboard-applied Phase 2 environments may have the new tables but not
-- the practice-facing columns on public.questions. Keep this hotfix narrow and
-- idempotent so approved questions can be loaded safely.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marks numeric(6, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.questions q
SET subject_id = c.subject_id
FROM public.chapters c
WHERE q.chapter_id = c.id
  AND q.subject_id IS NULL;

UPDATE public.questions
SET status = CASE WHEN is_approved THEN 'approved' ELSE 'pending_review' END,
    approved_at = CASE WHEN is_approved AND approved_at IS NULL THEN created_at ELSE approved_at END
WHERE status = 'pending_review';

DO $$
BEGIN
  ALTER TABLE public.questions
    ADD CONSTRAINT questions_phase2_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read approved questions" ON public.questions;
DROP POLICY IF EXISTS "Students read approved questions" ON public.questions;
CREATE POLICY "Students read approved questions" ON public.questions
  FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'approved' AND is_active);

DROP POLICY IF EXISTS "Students read approved question options" ON public.question_options;
CREATE POLICY "Students read approved question options" ON public.question_options
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.questions q
      WHERE q.id = question_options.question_id
        AND q.status = 'approved'
        AND q.is_active
    )
  );

REVOKE SELECT ON public.questions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  subject_id,
  chapter_id,
  question_type,
  difficulty,
  question_text,
  marks,
  status,
  is_active,
  created_at,
  updated_at
) ON public.questions TO authenticated;
GRANT SELECT ON public.question_options TO authenticated;

DO $$
DECLARE
  target_chapter_id uuid := '64896eb1-c80c-44ff-b593-aa9464beb93f';
BEGIN
  IF EXISTS (SELECT 1 FROM public.chapters WHERE id = target_chapter_id) THEN
    WITH seed(question_text, options, correct_answer, explanation_bn, difficulty) AS (
      VALUES
        (
          'Which cell structure mainly controls the movement of substances into and out of the cell?',
          '["Cell wall", "Cell membrane", "Nucleus", "Ribosome"]'::jsonb,
          'Cell membrane',
          'The cell membrane is selectively permeable, so it controls what enters and leaves the cell.',
          'easy'
        ),
        (
          'Which organelle contains most of the genetic material in a eukaryotic cell?',
          '["Nucleus", "Mitochondrion", "Golgi body", "Vacuole"]'::jsonb,
          'Nucleus',
          'In eukaryotic cells, most DNA is enclosed inside the nucleus.',
          'easy'
        ),
        (
          'Ribosomes are directly involved in which cellular process?',
          '["Photosynthesis", "Protein synthesis", "Lipid storage", "Water transport"]'::jsonb,
          'Protein synthesis',
          'Ribosomes read messenger RNA and join amino acids to make proteins.',
          'easy'
        ),
        (
          'Which statement best describes mitochondria?',
          '["They store hereditary information", "They release energy through cellular respiration", "They form the outer cell wall", "They digest only old chromosomes"]'::jsonb,
          'They release energy through cellular respiration',
          'Mitochondria produce usable energy for the cell through cellular respiration.',
          'medium'
        ),
        (
          'The plant cell wall is mainly composed of which substance?',
          '["Cellulose", "Glycogen", "Keratin", "Chitin"]'::jsonb,
          'Cellulose',
          'Cellulose is the major structural carbohydrate of plant cell walls.',
          'easy'
        )
    ),
    inserted_questions AS (
      INSERT INTO public.questions (
        chapter_id,
        question_type,
        difficulty,
        question_text,
        options,
        correct_answer,
        explanation_bn,
        is_approved,
        teacher_reviewed,
        source,
        subject_id,
        marks,
        status,
        is_active,
        approved_at
      )
      SELECT
        target_chapter_id,
        'mcq'::public.question_type,
        seed.difficulty::public.difficulty_level,
        seed.question_text,
        seed.options,
        seed.correct_answer,
        seed.explanation_bn,
        true,
        true,
        'manual_seed_cell_structure',
        chapters.subject_id,
        1,
        'approved',
        true,
        now()
      FROM seed
      JOIN public.chapters ON chapters.id = target_chapter_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.questions q
        WHERE q.chapter_id = target_chapter_id
          AND q.question_text = seed.question_text
      )
      RETURNING id, options
    ),
    target_questions AS (
      SELECT id, options FROM inserted_questions
      UNION ALL
      SELECT q.id, q.options
      FROM public.questions q
      JOIN seed ON seed.question_text = q.question_text
      WHERE q.chapter_id = target_chapter_id
        AND q.source = 'manual_seed_cell_structure'
    )
    INSERT INTO public.question_options (question_id, option_key, option_text, display_order)
    SELECT
      target_questions.id,
      chr(64 + opt.ordinality::integer),
      opt.option_text,
      opt.ordinality::integer
    FROM target_questions
    CROSS JOIN LATERAL jsonb_array_elements_text(target_questions.options)
      WITH ORDINALITY AS opt(option_text, ordinality)
    ON CONFLICT (question_id, option_key) DO NOTHING;
  ELSE
    RAISE NOTICE 'Chapter % was not found, so starter MCQs were not inserted.', target_chapter_id;
  END IF;
END $$;
