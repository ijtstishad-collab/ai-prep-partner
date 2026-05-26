
-- Resources catalog
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL CHECK (resource_type IN ('textbook','guide','test_paper','mcq_suggestion','question_bank','solution_book','admission_prep','external_link')),
  paper text,
  source_url text,
  page_reference text,
  mvp_use text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read approved resources" ON public.resources
  FOR SELECT TO authenticated
  USING (status = 'approved' OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage resources" ON public.resources
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_resources_subject ON public.resources(subject_id);
CREATE INDEX idx_resources_type ON public.resources(resource_type);

-- Study plans (one per user; replace strategy on insert)
CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  exam_date date NOT NULL,
  daily_minutes integer NOT NULL DEFAULT 60 CHECK (daily_minutes BETWEEN 10 AND 600),
  target_subject_ids uuid[] NOT NULL DEFAULT '{}',
  weak_subject_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own plan" ON public.study_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view plans" ON public.study_plans
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
