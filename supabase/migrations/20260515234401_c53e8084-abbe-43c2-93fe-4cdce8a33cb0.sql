
-- 1. syllabus_units
CREATE TABLE public.syllabus_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  title text NOT NULL,
  title_bn text,
  learning_objectives text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.syllabus_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read syllabus" ON public.syllabus_units FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage syllabus" ON public.syllabus_units FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.syllabus_units(chapter_id);

-- 2. textbook_chunks
CREATE TABLE public.textbook_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  content text NOT NULL,
  source text,
  page_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.textbook_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read chunks" ON public.textbook_chunks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage chunks" ON public.textbook_chunks FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.textbook_chunks(chapter_id);

-- 3. past_questions
CREATE TABLE public.past_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  year integer,
  board text,
  question_type question_type NOT NULL DEFAULT 'mcq',
  difficulty difficulty_level NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read past" ON public.past_questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage past" ON public.past_questions FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.past_questions(chapter_id);

-- 4. generation_rules
CREATE TABLE public.generation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  question_type question_type NOT NULL,
  instructions text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read rules" ON public.generation_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage rules" ON public.generation_rules FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- 5. generated_questions
CREATE TABLE public.generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  question_type question_type NOT NULL,
  difficulty difficulty_level NOT NULL,
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  explanation_bn text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  is_teacher_reviewed boolean NOT NULL DEFAULT false,
  quality_score integer CHECK (quality_score BETWEEN 1 AND 5),
  source_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own generated" ON public.generated_questions FOR SELECT
  USING (auth.uid() = user_id OR status = 'approved' OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage generated" ON public.generated_questions FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.generated_questions(user_id);
CREATE INDEX ON public.generated_questions(chapter_id);

-- 6. question_reviews
CREATE TABLE public.question_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_question_id uuid NOT NULL REFERENCES public.generated_questions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  action text NOT NULL, -- approve | reject | edit
  notes text,
  quality_score integer CHECK (quality_score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reviews" ON public.question_reviews FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
