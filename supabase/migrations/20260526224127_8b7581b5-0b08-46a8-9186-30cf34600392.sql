
CREATE TABLE public.mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mock_type text NOT NULL CHECK (mock_type IN ('chapter','subject','board_pattern','final_hsc')),
  subject_id uuid,
  chapter_id uuid,
  board text,
  year_range_start integer,
  year_range_end integer,
  question_count integer NOT NULL DEFAULT 20,
  source_mode text NOT NULL DEFAULT 'verified' CHECK (source_mode IN ('verified','patterns','mixed','ai_similar')),
  difficulty text NOT NULL DEFAULT 'mixed' CHECK (difficulty IN ('easy','medium','hard','mixed')),
  language text NOT NULL DEFAULT 'bn' CHECK (language IN ('bn','en','mixed')),
  timer_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_taken integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  accuracy numeric NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  has_ai_similar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_tests TO authenticated;
GRANT ALL ON public.mock_tests TO service_role;

ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mocks" ON public.mock_tests
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all mocks" ON public.mock_tests
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mock_tests_user ON public.mock_tests(user_id, started_at DESC);

CREATE TABLE public.mock_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'past_questions',
  order_number integer NOT NULL,
  selected_answer text,
  is_correct boolean,
  is_marked_for_review boolean NOT NULL DEFAULT false,
  time_taken integer NOT NULL DEFAULT 0,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_test_questions TO authenticated;
GRANT ALL ON public.mock_test_questions TO service_role;

ALTER TABLE public.mock_test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mock questions" ON public.mock_test_questions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mock_tests m WHERE m.id = mock_test_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mock_tests m WHERE m.id = mock_test_id AND m.user_id = auth.uid()));

CREATE POLICY "Admins view all mock questions" ON public.mock_test_questions
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mock_test_questions_mock ON public.mock_test_questions(mock_test_id, order_number);

ALTER TABLE public.revision_items
  ADD COLUMN IF NOT EXISTS mock_test_id uuid REFERENCES public.mock_tests(id) ON DELETE SET NULL;
