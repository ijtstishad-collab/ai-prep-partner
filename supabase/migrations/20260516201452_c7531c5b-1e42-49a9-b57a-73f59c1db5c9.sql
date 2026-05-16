
-- 1. readiness_status on chapters
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS readiness_status text NOT NULL DEFAULT 'not_started';
DO $$ BEGIN
  ALTER TABLE public.chapters ADD CONSTRAINT chapters_readiness_status_check
    CHECK (readiness_status IN ('not_started','content_added','ai_ready','teacher_reviewed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique index for idempotent chapter upserts
CREATE UNIQUE INDEX IF NOT EXISTS chapters_subject_name_uniq ON public.chapters (subject_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_slug_uniq ON public.subjects (slug);

-- 2. demo_questions
CREATE TABLE IF NOT EXISTS public.demo_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  question_type question_type NOT NULL DEFAULT 'mcq',
  difficulty difficulty_level NOT NULL DEFAULT 'easy',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  explanation_bn text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read demo" ON public.demo_questions;
CREATE POLICY "Auth read demo" ON public.demo_questions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins manage demo" ON public.demo_questions;
CREATE POLICY "Admins manage demo" ON public.demo_questions FOR ALL
  USING (private.has_role(auth.uid(),'admin'))
  WITH CHECK (private.has_role(auth.uid(),'admin'));

-- 3. Readiness compute function
CREATE OR REPLACE FUNCTION public.compute_chapter_readiness(_chapter_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subject uuid;
  v_units int; v_chunks int; v_past int; v_rules int; v_reviewed int;
BEGIN
  SELECT subject_id INTO v_subject FROM public.chapters WHERE id = _chapter_id;
  IF v_subject IS NULL THEN RETURN 'not_started'; END IF;
  SELECT count(*) INTO v_units FROM public.syllabus_units WHERE chapter_id = _chapter_id;
  SELECT count(*) INTO v_chunks FROM public.textbook_chunks WHERE chapter_id = _chapter_id;
  SELECT count(*) INTO v_past FROM public.past_questions WHERE chapter_id = _chapter_id;
  SELECT count(*) INTO v_rules FROM public.generation_rules WHERE subject_id = v_subject AND is_active;
  SELECT count(*) INTO v_reviewed FROM public.generated_questions
    WHERE chapter_id = _chapter_id AND status = 'approved' AND is_teacher_reviewed;
  IF v_reviewed > 0 THEN RETURN 'teacher_reviewed'; END IF;
  IF v_units > 0 AND v_chunks > 0 AND v_past > 0 AND v_rules > 0 THEN RETURN 'ai_ready'; END IF;
  IF v_units > 0 OR v_chunks > 0 OR v_past > 0 THEN RETURN 'content_added'; END IF;
  RETURN 'not_started';
END $$;

-- 4. Seed subjects
INSERT INTO public.subjects (name, name_bn, slug, icon, is_active) VALUES
  ('Physics 1st Paper', 'পদার্থবিজ্ঞান ১ম পত্র', 'physics-1', 'Atom', true),
  ('Chemistry 1st Paper', 'রসায়ন ১ম পত্র', 'chemistry-1', 'FlaskConical', true),
  ('Biology 1st Paper', 'জীববিজ্ঞান ১ম পত্র', 'biology-1', 'Leaf', true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_bn = EXCLUDED.name_bn, icon = EXCLUDED.icon, is_active = true;

-- 5. Seed chapters
WITH s AS (SELECT id, slug FROM public.subjects WHERE slug IN ('physics-1','chemistry-1','biology-1'))
INSERT INTO public.chapters (subject_id, name, order_index, is_active)
SELECT s.id, c.name, c.ord, true FROM s
JOIN (VALUES
  ('physics-1','Physical World and Measurement',1),
  ('physics-1','Vector',2),
  ('physics-1','Dynamics',3),
  ('physics-1','Newtonian Mechanics',4),
  ('physics-1','Work, Energy and Power',5),
  ('physics-1','Gravitation',6),
  ('physics-1','Properties of Matter',7),
  ('physics-1','Periodic Motion',8),
  ('physics-1','Wave',9),
  ('physics-1','Ideal Gas and Kinetic Theory',10),
  ('chemistry-1','Laboratory Safety',1),
  ('chemistry-1','Qualitative Chemistry',2),
  ('chemistry-1','Periodic Properties',3),
  ('chemistry-1','Chemical Bonding',4),
  ('chemistry-1','Chemical Change',5),
  ('chemistry-1','Chemistry of Elements',6),
  ('chemistry-1','Organic Chemistry',7),
  ('biology-1','Cell and Its Structure',1),
  ('biology-1','Cell Division',2),
  ('biology-1','Cell Chemistry',3),
  ('biology-1','Microorganisms',4),
  ('biology-1','Algae and Fungi',5),
  ('biology-1','Bryophyta and Pteridophyta',6),
  ('biology-1','Gymnosperm and Angiosperm',7),
  ('biology-1','Tissue and Tissue System',8),
  ('biology-1','Plant Physiology',9),
  ('biology-1','Biotechnology',10)
) AS c(slug,name,ord) ON c.slug = s.slug
ON CONFLICT (subject_id, name) DO UPDATE SET order_index = EXCLUDED.order_index, is_active = true;

-- 6. Seed demo questions (one per subject's first chapter — enough to render demo mode)
WITH p AS (
  SELECT c.id AS chapter_id, c.subject_id
  FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
  WHERE s.slug = 'physics-1' AND c.name = 'Physical World and Measurement'
)
INSERT INTO public.demo_questions (chapter_id, subject_id, question_type, difficulty, question_text, options, correct_answer, explanation_bn)
SELECT p.chapter_id, p.subject_id, 'mcq', 'easy', q.qt, q.opts::jsonb, q.ans, q.exp FROM p
JOIN (VALUES
  ('What is the SI unit of force?','["Newton","Joule","Watt","Pascal"]','Newton','বলের এসআই একক হলো নিউটন (N)।'),
  ('Which of the following is a fundamental quantity?','["Force","Velocity","Length","Energy"]','Length','দৈর্ঘ্য একটি মৌলিক রাশি; অন্যগুলো লব্ধ রাশি।'),
  ('1 light year is a unit of?','["Time","Distance","Speed","Energy"]','Distance','আলোকবর্ষ দূরত্বের একক।'),
  ('Significant figures in 0.00450 are?','["2","3","4","5"]','3','অগ্রবর্তী শূন্য গণনা হয় না; ৪, ৫, ০ — মোট ৩টি।')
) AS q(qt,opts,ans,exp) ON true
ON CONFLICT DO NOTHING;

WITH p AS (
  SELECT c.id AS chapter_id, c.subject_id FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
  WHERE s.slug = 'chemistry-1' AND c.name = 'Laboratory Safety'
)
INSERT INTO public.demo_questions (chapter_id, subject_id, question_type, difficulty, question_text, options, correct_answer, explanation_bn)
SELECT p.chapter_id, p.subject_id, 'mcq', 'easy', q.qt, q.opts::jsonb, q.ans, q.exp FROM p
JOIN (VALUES
  ('Which symbol indicates a flammable substance?','["Flame","Skull","Cross","Exclamation"]','Flame','দাহ্য পদার্থের চিহ্ন হলো শিখা (flame)।'),
  ('What should you do first if acid spills on your skin?','["Wipe with cloth","Wash with plenty of water","Apply oil","Ignore"]','Wash with plenty of water','অ্যাসিড পড়লে প্রচুর পানি দিয়ে ধুতে হবে।'),
  ('Which equipment protects the eyes in lab?','["Gloves","Goggles","Mask","Apron"]','Goggles','গগলস চোখকে রক্ষা করে।')
) AS q(qt,opts,ans,exp) ON true
ON CONFLICT DO NOTHING;

WITH p AS (
  SELECT c.id AS chapter_id, c.subject_id FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
  WHERE s.slug = 'biology-1' AND c.name = 'Cell and Its Structure'
)
INSERT INTO public.demo_questions (chapter_id, subject_id, question_type, difficulty, question_text, options, correct_answer, explanation_bn)
SELECT p.chapter_id, p.subject_id, 'mcq', 'easy', q.qt, q.opts::jsonb, q.ans, q.exp FROM p
JOIN (VALUES
  ('Powerhouse of the cell is?','["Nucleus","Mitochondria","Ribosome","Golgi body"]','Mitochondria','মাইটোকন্ড্রিয়া কোষের শক্তিঘর।'),
  ('Which organelle synthesizes protein?','["Lysosome","Ribosome","Centrosome","Vacuole"]','Ribosome','রাইবোজোম প্রোটিন সংশ্লেষ করে।'),
  ('Cell wall in plant cells is made mainly of?','["Chitin","Cellulose","Peptidoglycan","Lipid"]','Cellulose','উদ্ভিদ কোষের কোষপ্রাচীর সেলুলোজ দ্বারা গঠিত।')
) AS q(qt,opts,ans,exp) ON true
ON CONFLICT DO NOTHING;
