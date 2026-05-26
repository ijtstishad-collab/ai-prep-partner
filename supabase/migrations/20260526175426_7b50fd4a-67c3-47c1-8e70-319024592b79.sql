
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS board text,
  ADD COLUMN IF NOT EXISTS weak_subject_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS preferred_study_days text[] NOT NULL DEFAULT '{}';

-- 2. Extend subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS paper text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 3. revision_items
CREATE TABLE IF NOT EXISTS public.revision_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'past_questions',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id, source_table)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_items TO authenticated;
GRANT ALL ON public.revision_items TO service_role;

ALTER TABLE public.revision_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own revision"
  ON public.revision_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view revision"
  ON public.revision_items
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 4. Seed HSC subjects (idempotent by slug)
INSERT INTO public.subjects (name, name_bn, slug, group_type, paper, sort_order, is_active) VALUES
  ('Bangla 1st Paper', 'বাংলা ১ম পত্র', 'bangla-1', 'general', '1st Paper', 1, true),
  ('Bangla 2nd Paper', 'বাংলা ২য় পত্র', 'bangla-2', 'general', '2nd Paper', 2, true),
  ('English 1st Paper', 'ইংরেজি ১ম পত্র', 'english-1', 'general', '1st Paper', 3, true),
  ('English 2nd Paper', 'ইংরেজি ২য় পত্র', 'english-2', 'general', '2nd Paper', 4, true),
  ('ICT', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ict', 'general', 'Common', 5, true),
  ('Physics 1st Paper', 'পদার্থবিজ্ঞান ১ম পত্র', 'physics-1', 'science', '1st Paper', 10, true),
  ('Physics 2nd Paper', 'পদার্থবিজ্ঞান ২য় পত্র', 'physics-2', 'science', '2nd Paper', 11, true),
  ('Chemistry 1st Paper', 'রসায়ন ১ম পত্র', 'chemistry-1', 'science', '1st Paper', 12, true),
  ('Chemistry 2nd Paper', 'রসায়ন ২য় পত্র', 'chemistry-2', 'science', '2nd Paper', 13, true),
  ('Biology 1st Paper', 'জীববিজ্ঞান ১ম পত্র', 'biology-1', 'science', '1st Paper', 14, true),
  ('Biology 2nd Paper', 'জীববিজ্ঞান ২য় পত্র', 'biology-2', 'science', '2nd Paper', 15, true),
  ('Higher Math 1st Paper', 'উচ্চতর গণিত ১ম পত্র', 'higher-math-1', 'science', '1st Paper', 16, true),
  ('Higher Math 2nd Paper', 'উচ্চতর গণিত ২য় পত্র', 'higher-math-2', 'science', '2nd Paper', 17, true),
  ('Accounting 1st Paper', 'হিসাববিজ্ঞান ১ম পত্র', 'accounting-1', 'business', '1st Paper', 20, true),
  ('Accounting 2nd Paper', 'হিসাববিজ্ঞান ২য় পত্র', 'accounting-2', 'business', '2nd Paper', 21, true),
  ('Business Organization & Management 1st Paper', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা ১ম পত্র', 'bom-1', 'business', '1st Paper', 22, true),
  ('Business Organization & Management 2nd Paper', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা ২য় পত্র', 'bom-2', 'business', '2nd Paper', 23, true),
  ('Finance, Banking & Insurance 1st Paper', 'ফিন্যান্স, ব্যাংকিং ও বীমা ১ম পত্র', 'finance-1', 'business', '1st Paper', 24, true),
  ('Finance, Banking & Insurance 2nd Paper', 'ফিন্যান্স, ব্যাংকিং ও বীমা ২য় পত্র', 'finance-2', 'business', '2nd Paper', 25, true),
  ('Production Management & Marketing 1st Paper', 'উৎপাদন ব্যবস্থাপনা ও বিপণন ১ম পত্র', 'pmm-1', 'business', '1st Paper', 26, true),
  ('Production Management & Marketing 2nd Paper', 'উৎপাদন ব্যবস্থাপনা ও বিপণন ২য় পত্র', 'pmm-2', 'business', '2nd Paper', 27, true),
  ('Economics 1st Paper', 'অর্থনীতি ১ম পত্র', 'economics-1', 'business', '1st Paper', 28, true),
  ('Economics 2nd Paper', 'অর্থনীতি ২য় পত্র', 'economics-2', 'business', '2nd Paper', 29, true),
  ('Civics 1st Paper', 'পৌরনীতি ১ম পত্র', 'civics-1', 'humanities', '1st Paper', 40, true),
  ('Civics 2nd Paper', 'পৌরনীতি ২য় পত্র', 'civics-2', 'humanities', '2nd Paper', 41, true),
  ('History 1st Paper', 'ইতিহাস ১ম পত্র', 'history-1', 'humanities', '1st Paper', 42, true),
  ('History 2nd Paper', 'ইতিহাস ২য় পত্র', 'history-2', 'humanities', '2nd Paper', 43, true),
  ('Islamic History 1st Paper', 'ইসলামের ইতিহাস ১ম পত্র', 'islamic-history-1', 'humanities', '1st Paper', 44, true),
  ('Islamic History 2nd Paper', 'ইসলামের ইতিহাস ২য় পত্র', 'islamic-history-2', 'humanities', '2nd Paper', 45, true),
  ('Geography 1st Paper', 'ভূগোল ১ম পত্র', 'geography-1', 'humanities', '1st Paper', 46, true),
  ('Geography 2nd Paper', 'ভূগোল ২য় পত্র', 'geography-2', 'humanities', '2nd Paper', 47, true),
  ('Sociology 1st Paper', 'সমাজবিজ্ঞান ১ম পত্র', 'sociology-1', 'humanities', '1st Paper', 48, true),
  ('Sociology 2nd Paper', 'সমাজবিজ্ঞান ২য় পত্র', 'sociology-2', 'humanities', '2nd Paper', 49, true),
  ('Social Work 1st Paper', 'সমাজকর্ম ১ম পত্র', 'social-work-1', 'humanities', '1st Paper', 50, true),
  ('Social Work 2nd Paper', 'সমাজকর্ম ২য় পত্র', 'social-work-2', 'humanities', '2nd Paper', 51, true),
  ('Logic 1st Paper', 'যুক্তিবিদ্যা ১ম পত্র', 'logic-1', 'humanities', '1st Paper', 52, true),
  ('Logic 2nd Paper', 'যুক্তিবিদ্যা ২য় পত্র', 'logic-2', 'humanities', '2nd Paper', 53, true),
  ('Islamic Studies 1st Paper', 'ইসলাম শিক্ষা ১ম পত্র', 'islamic-studies-1', 'humanities', '1st Paper', 54, true),
  ('Islamic Studies 2nd Paper', 'ইসলাম শিক্ষা ২য় পত্র', 'islamic-studies-2', 'humanities', '2nd Paper', 55, true)
ON CONFLICT (slug) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  group_type = EXCLUDED.group_type,
  paper = EXCLUDED.paper,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
