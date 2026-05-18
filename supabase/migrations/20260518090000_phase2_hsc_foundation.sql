-- Phase 2: Supabase-first HSC exam preparation foundation.
-- This migration keeps the UI untouched and focuses on safe database/RLS shape.

-- Base enums. The live Supabase dashboard may not have the older Lovable
-- migrations applied, so create missing enum types before extending them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
  ) THEN
    EXECUTE 'CREATE TYPE public.app_role AS ENUM (''admin'', ''student'', ''reviewer'')';
  END IF;
END;
$$;

DO $$
BEGIN
  EXECUTE 'ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS ''reviewer''';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'question_type'
  ) THEN
    EXECUTE 'CREATE TYPE public.question_type AS ENUM (''mcq'', ''short'', ''written'')';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'difficulty_level'
  ) THEN
    EXECUTE 'CREATE TYPE public.difficulty_level AS ENUM (''easy'', ''medium'', ''hard'')';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Compatibility base tables. These mirror the earlier app foundation enough
-- for this migration to run on a dashboard database that has not applied the
-- old migrations yet.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  class text,
  student_group text DEFAULT 'Science',
  target_exam_year integer,
  subscription_tier text NOT NULL DEFAULT 'free',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  slug text NOT NULL UNIQUE,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_bn text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  readiness_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL DEFAULT '',
  explanation_bn text,
  is_approved boolean NOT NULL DEFAULT false,
  teacher_reviewed boolean NOT NULL DEFAULT false,
  source text DEFAULT 'ai',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.past_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  year integer,
  board text,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.demo_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  difficulty public.difficulty_level NOT NULL DEFAULT 'easy',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL DEFAULT '',
  explanation_bn text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL DEFAULT '',
  explanation_bn text,
  status text NOT NULL DEFAULT 'pending',
  is_teacher_reviewed boolean NOT NULL DEFAULT false,
  quality_score integer CHECK (quality_score BETWEEN 1 AND 5),
  source_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_questions ENABLE ROW LEVEL SECURITY;

-- app_roles is the Phase 2 role assignment table. user_roles remains for
-- compatibility with the existing auth context.
CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

-- Copy existing roles into the new Phase 2 table.
INSERT INTO public.app_roles (user_id, role, created_at)
SELECT user_id, role, min(created_at)
FROM public.user_roles
GROUP BY user_id, role
ON CONFLICT (user_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type_id uuid NOT NULL REFERENCES public.exam_types(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_type_id, code)
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public."groups" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type_id uuid NOT NULL REFERENCES public.exam_types(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_type_id, slug)
);
ALTER TABLE public."groups" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  board_type text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Extend existing profile and content tables rather than replacing them.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Published question rows must not be the public source of truth for answer keys.
-- Legacy correct_answer/explanation columns stay for compatibility but are not
-- granted to students.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_year integer,
  ADD COLUMN IF NOT EXISTS marks numeric(6, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  option_text text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, option_key),
  UNIQUE (question_id, display_order)
);
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

-- Backfill public options from the legacy JSON array if present. This table
-- intentionally has no is_correct column.
INSERT INTO public.question_options (question_id, option_key, option_text, display_order)
SELECT q.id,
       chr(64 + opt.ordinality::integer),
       opt.option_text,
       opt.ordinality::integer
FROM public.questions q
CROSS JOIN LATERAL jsonb_array_elements_text(q.options) WITH ORDINALITY AS opt(option_text, ordinality)
WHERE q.options IS NOT NULL
  AND jsonb_typeof(q.options) = 'array'
ON CONFLICT (question_id, option_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.question_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  exam_type_id uuid NOT NULL REFERENCES public.exam_types(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE RESTRICT,
  board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
  board_year integer,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  explanation text,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.question_drafts
    ADD CONSTRAINT question_drafts_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES public.question_drafts(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  before_status text,
  after_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.admin_reviews
    ADD CONSTRAINT admin_reviews_action_check
    CHECK (action IN ('create', 'edit', 'submit', 'approve', 'reject', 'archive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mock_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type_id uuid NOT NULL REFERENCES public.exam_types(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  total_marks numeric(8, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.mock_exams
    ADD CONSTRAINT mock_exams_status_check
    CHECK (status IN ('draft', 'published', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mock_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_exam_id uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  display_order integer NOT NULL DEFAULT 0,
  marks numeric(6, 2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mock_exam_id, question_id),
  UNIQUE (mock_exam_id, display_order)
);
ALTER TABLE public.mock_exam_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_type text NOT NULL DEFAULT 'practice',
  exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  mock_exam_id uuid REFERENCES public.mock_exams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  duration_seconds integer,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  score numeric(8, 2) NOT NULL DEFAULT 0,
  max_score numeric(8, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.attempts
    ADD CONSTRAINT attempts_type_check
    CHECK (attempt_type IN ('practice', 'chapter_practice', 'mock_exam'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.attempts
    ADD CONSTRAINT attempts_status_check
    CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mock_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mock_exam_id uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.attempts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  score numeric(8, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mock_exam_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.mock_exam_sessions
    ADD CONSTRAINT mock_exam_sessions_status_check
    CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  mock_exam_session_id uuid REFERENCES public.mock_exam_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  question_option_id uuid REFERENCES public.question_options(id) ON DELETE SET NULL,
  answer_text text,
  is_correct boolean,
  points_awarded numeric(6, 2),
  answered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chapter_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_type_id uuid REFERENCES public.exam_types(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public."groups"(id) ON DELETE SET NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  attempted_count integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  accuracy numeric(6, 2) NOT NULL DEFAULT 0,
  weak_score numeric(6, 2) NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);
ALTER TABLE public.chapter_analytics ENABLE ROW LEVEL SECURITY;

-- Helper functions used only by RLS policies.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_roles ar
    WHERE ar.user_id = _user_id
      AND ar.role::text = ANY(_roles)
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_reviewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin', 'reviewer'])
$$;

CREATE OR REPLACE FUNCTION private.student_can_write_attempt(_attempt_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attempts a
    WHERE a.id = _attempt_id
      AND a.user_id = _user_id
      AND a.status = 'in_progress'
  )
$$;

GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_or_reviewer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.student_can_write_attempt(uuid, uuid) TO anon, authenticated;

-- Keep signup behavior compatible while also writing the Phase 2 app_roles row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.app_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Seed HSC taxonomy.
INSERT INTO public.exam_types (code, name, description, sort_order, is_active)
VALUES ('HSC', 'Higher Secondary Certificate', 'Bangladeshi HSC exam preparation track.', 1, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

WITH hsc AS (
  SELECT id FROM public.exam_types WHERE code = 'HSC'
)
INSERT INTO public.classes (exam_type_id, code, name, sort_order, is_active)
SELECT hsc.id, seed.code, seed.name, seed.sort_order, true
FROM hsc
CROSS JOIN (VALUES
  ('class-11', 'Class 11', 1),
  ('class-12', 'Class 12', 2)
) AS seed(code, name, sort_order)
ON CONFLICT (exam_type_id, code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

WITH hsc AS (
  SELECT id FROM public.exam_types WHERE code = 'HSC'
)
INSERT INTO public."groups" (exam_type_id, slug, name, sort_order, is_active)
SELECT hsc.id, seed.slug, seed.name, seed.sort_order, true
FROM hsc
CROSS JOIN (VALUES
  ('science', 'Science', 1),
  ('business-studies', 'Business Studies', 2),
  ('humanities', 'Humanities', 3)
) AS seed(slug, name, sort_order)
ON CONFLICT (exam_type_id, slug) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.boards (slug, name, board_type, is_active)
VALUES
  ('dhaka', 'Dhaka Education Board', 'general', true),
  ('chattogram', 'Chattogram Education Board', 'general', true),
  ('rajshahi', 'Rajshahi Education Board', 'general', true),
  ('cumilla', 'Cumilla Education Board', 'general', true),
  ('jashore', 'Jashore Education Board', 'general', true),
  ('barishal', 'Barishal Education Board', 'general', true),
  ('sylhet', 'Sylhet Education Board', 'general', true),
  ('dinajpur', 'Dinajpur Education Board', 'general', true),
  ('mymensingh', 'Mymensingh Education Board', 'general', true),
  ('madrasah', 'Bangladesh Madrasah Education Board', 'madrasah', true),
  ('technical', 'Bangladesh Technical Education Board', 'technical', true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    board_type = EXCLUDED.board_type,
    is_active = EXCLUDED.is_active,
    updated_at = now();

WITH hsc AS (
  SELECT id FROM public.exam_types WHERE code = 'HSC'
),
subject_seed(slug, name, group_slug, icon, sort_order) AS (
  VALUES
    ('bangla', 'Bangla', NULL, 'BookOpenText', 1),
    ('english', 'English', NULL, 'BookOpenText', 2),
    ('ict', 'Information and Communication Technology', NULL, 'Monitor', 3),
    ('physics-1', 'Physics 1st Paper', 'science', 'Atom', 10),
    ('physics-2', 'Physics 2nd Paper', 'science', 'Atom', 11),
    ('chemistry-1', 'Chemistry 1st Paper', 'science', 'FlaskConical', 12),
    ('chemistry-2', 'Chemistry 2nd Paper', 'science', 'FlaskConical', 13),
    ('biology-1', 'Biology 1st Paper', 'science', 'Leaf', 14),
    ('biology-2', 'Biology 2nd Paper', 'science', 'Leaf', 15),
    ('higher-math-1', 'Higher Mathematics 1st Paper', 'science', 'Calculator', 16),
    ('higher-math-2', 'Higher Mathematics 2nd Paper', 'science', 'Calculator', 17),
    ('accounting-1', 'Accounting 1st Paper', 'business-studies', 'ReceiptText', 30),
    ('accounting-2', 'Accounting 2nd Paper', 'business-studies', 'ReceiptText', 31),
    ('business-organization-1', 'Business Organization and Management 1st Paper', 'business-studies', 'BriefcaseBusiness', 32),
    ('business-organization-2', 'Business Organization and Management 2nd Paper', 'business-studies', 'BriefcaseBusiness', 33),
    ('finance-banking-insurance-1', 'Finance, Banking and Insurance 1st Paper', 'business-studies', 'Landmark', 34),
    ('finance-banking-insurance-2', 'Finance, Banking and Insurance 2nd Paper', 'business-studies', 'Landmark', 35),
    ('production-management-marketing-1', 'Production Management and Marketing 1st Paper', 'business-studies', 'ChartNoAxesCombined', 36),
    ('production-management-marketing-2', 'Production Management and Marketing 2nd Paper', 'business-studies', 'ChartNoAxesCombined', 37),
    ('economics-1', 'Economics 1st Paper', 'humanities', 'TrendingUp', 50),
    ('economics-2', 'Economics 2nd Paper', 'humanities', 'TrendingUp', 51),
    ('civics-1', 'Civics and Good Governance 1st Paper', 'humanities', 'Scale', 52),
    ('civics-2', 'Civics and Good Governance 2nd Paper', 'humanities', 'Scale', 53),
    ('sociology-1', 'Sociology 1st Paper', 'humanities', 'UsersRound', 54),
    ('sociology-2', 'Sociology 2nd Paper', 'humanities', 'UsersRound', 55),
    ('history-1', 'History 1st Paper', 'humanities', 'Landmark', 56),
    ('history-2', 'History 2nd Paper', 'humanities', 'Landmark', 57),
    ('geography-1', 'Geography 1st Paper', 'humanities', 'Globe2', 58),
    ('geography-2', 'Geography 2nd Paper', 'humanities', 'Globe2', 59),
    ('logic-1', 'Logic 1st Paper', 'humanities', 'Brain', 60),
    ('logic-2', 'Logic 2nd Paper', 'humanities', 'Brain', 61)
)
INSERT INTO public.subjects (exam_type_id, group_id, slug, name, icon, sort_order, is_active)
SELECT hsc.id, g.id, s.slug, s.name, s.icon, s.sort_order, true
FROM subject_seed s
CROSS JOIN hsc
LEFT JOIN public."groups" g
  ON g.exam_type_id = hsc.id
 AND g.slug = s.group_slug
ON CONFLICT (slug) DO UPDATE
SET exam_type_id = EXCLUDED.exam_type_id,
    group_id = EXCLUDED.group_id,
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

UPDATE public.chapters c
SET exam_type_id = s.exam_type_id,
    group_id = s.group_id
FROM public.subjects s
WHERE c.subject_id = s.id
  AND (c.exam_type_id IS NULL OR c.group_id IS NULL);

-- RLS policies

DROP POLICY IF EXISTS "Users read own app roles" ON public.app_roles;
DROP POLICY IF EXISTS "Admins read all app roles" ON public.app_roles;
DROP POLICY IF EXISTS "Admins insert app roles for others" ON public.app_roles;
DROP POLICY IF EXISTS "Admins update app roles for others" ON public.app_roles;
DROP POLICY IF EXISTS "Admins delete app roles for others" ON public.app_roles;

DROP POLICY IF EXISTS "Authenticated read active exam types" ON public.exam_types;
DROP POLICY IF EXISTS "Admins manage exam types" ON public.exam_types;
DROP POLICY IF EXISTS "Authenticated read active classes" ON public.classes;
DROP POLICY IF EXISTS "Admins manage classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated read active groups" ON public."groups";
DROP POLICY IF EXISTS "Admins manage groups" ON public."groups";
DROP POLICY IF EXISTS "Authenticated read active boards" ON public.boards;
DROP POLICY IF EXISTS "Admins manage boards" ON public.boards;

DROP POLICY IF EXISTS "Students read approved questions" ON public.questions;
DROP POLICY IF EXISTS "Reviewers manage questions" ON public.questions;
DROP POLICY IF EXISTS "Students read approved question options" ON public.question_options;
DROP POLICY IF EXISTS "Reviewers manage question options" ON public.question_options;
DROP POLICY IF EXISTS "Reviewers manage question drafts" ON public.question_drafts;
DROP POLICY IF EXISTS "Reviewers manage admin reviews" ON public.admin_reviews;
DROP POLICY IF EXISTS "Students read published mock exams" ON public.mock_exams;
DROP POLICY IF EXISTS "Reviewers manage mock exams" ON public.mock_exams;
DROP POLICY IF EXISTS "Students read published mock exam questions" ON public.mock_exam_questions;
DROP POLICY IF EXISTS "Reviewers manage mock exam questions" ON public.mock_exam_questions;
DROP POLICY IF EXISTS "Students read own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students create own ungraded attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students update own ungraded attempts" ON public.attempts;
DROP POLICY IF EXISTS "Reviewers read attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students read own mock sessions" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Students create own mock sessions" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Students update own active mock sessions" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Reviewers read mock sessions" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Students read own answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students insert own ungraded answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students update own ungraded answers" ON public.student_answers;
DROP POLICY IF EXISTS "Reviewers read student answers" ON public.student_answers;
DROP POLICY IF EXISTS "Reviewers grade student answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students read own chapter analytics" ON public.chapter_analytics;
DROP POLICY IF EXISTS "Reviewers read chapter analytics" ON public.chapter_analytics;
DROP POLICY IF EXISTS "Reviewers manage chapter analytics" ON public.chapter_analytics;

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile (no subscription change)" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;

CREATE POLICY "Students read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Students insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Students update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND subscription_tier = (SELECT p.subscription_tier FROM public.profiles p WHERE p.id = auth.uid())
  );
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (private.has_any_role(auth.uid(), ARRAY['admin']));
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Users read own legacy roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all legacy roles" ON public.user_roles
  FOR SELECT USING (private.has_any_role(auth.uid(), ARRAY['admin']));
CREATE POLICY "Admins insert legacy roles for others" ON public.user_roles
  FOR INSERT WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());
CREATE POLICY "Admins update legacy roles for others" ON public.user_roles
  FOR UPDATE USING (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid())
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());
CREATE POLICY "Admins delete legacy roles for others" ON public.user_roles
  FOR DELETE USING (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());

CREATE POLICY "Users read own app roles" ON public.app_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all app roles" ON public.app_roles
  FOR SELECT USING (private.has_any_role(auth.uid(), ARRAY['admin']));
CREATE POLICY "Admins insert app roles for others" ON public.app_roles
  FOR INSERT WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());
CREATE POLICY "Admins update app roles for others" ON public.app_roles
  FOR UPDATE USING (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid())
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());
CREATE POLICY "Admins delete app roles for others" ON public.app_roles
  FOR DELETE USING (private.has_any_role(auth.uid(), ARRAY['admin']) AND user_id <> auth.uid());

CREATE POLICY "Authenticated read active exam types" ON public.exam_types
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage exam types" ON public.exam_types
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

CREATE POLICY "Authenticated read active classes" ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage classes" ON public.classes
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

CREATE POLICY "Authenticated read active groups" ON public."groups"
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage groups" ON public."groups"
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

CREATE POLICY "Authenticated read active boards" ON public.boards
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage boards" ON public.boards
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

DROP POLICY IF EXISTS "Anyone reads active subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Authenticated read active subjects" ON public.subjects
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage subjects" ON public.subjects
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

DROP POLICY IF EXISTS "Anyone reads active chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Authenticated read active chapters" ON public.chapters
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY "Admins manage chapters" ON public.chapters
  FOR ALL USING (private.has_any_role(auth.uid(), ARRAY['admin']))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin']));

DROP POLICY IF EXISTS "Authenticated read approved questions" ON public.questions;
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
CREATE POLICY "Students read approved questions" ON public.questions
  FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'approved' AND is_active);
CREATE POLICY "Reviewers manage questions" ON public.questions
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read approved question options" ON public.question_options
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.questions q
      WHERE q.id = question_id
        AND q.status = 'approved'
        AND q.is_active
    )
  );
CREATE POLICY "Reviewers manage question options" ON public.question_options
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Reviewers manage question drafts" ON public.question_drafts
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Reviewers manage admin reviews" ON public.admin_reviews
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()) AND reviewer_id = auth.uid());

CREATE POLICY "Students read published mock exams" ON public.mock_exams
  FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'published' AND is_active);
CREATE POLICY "Reviewers manage mock exams" ON public.mock_exams
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read published mock exam questions" ON public.mock_exam_questions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.mock_exams me
      WHERE me.id = mock_exam_id
        AND me.status = 'published'
        AND me.is_active
    )
    AND EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id
        AND q.status = 'approved'
        AND q.is_active
    )
  );
CREATE POLICY "Reviewers manage mock exam questions" ON public.mock_exam_questions
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read own attempts" ON public.attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students create own ungraded attempts" ON public.attempts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'in_progress'
    AND correct_count = 0
    AND score = 0
  );
CREATE POLICY "Students update own ungraded attempts" ON public.attempts
  FOR UPDATE USING (auth.uid() = user_id AND status = 'in_progress')
  WITH CHECK (
    auth.uid() = user_id
    AND correct_count = 0
    AND score = 0
  );
CREATE POLICY "Reviewers read attempts" ON public.attempts
  FOR SELECT USING (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read own mock sessions" ON public.mock_exam_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students create own mock sessions" ON public.mock_exam_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'in_progress' AND score = 0);
CREATE POLICY "Students update own active mock sessions" ON public.mock_exam_sessions
  FOR UPDATE USING (auth.uid() = user_id AND status = 'in_progress')
  WITH CHECK (auth.uid() = user_id AND score = 0);
CREATE POLICY "Reviewers read mock sessions" ON public.mock_exam_sessions
  FOR SELECT USING (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read own answers" ON public.student_answers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students insert own ungraded answers" ON public.student_answers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND private.student_can_write_attempt(attempt_id, auth.uid())
    AND is_correct IS NULL
    AND points_awarded IS NULL
  );
CREATE POLICY "Students update own ungraded answers" ON public.student_answers
  FOR UPDATE USING (
    auth.uid() = user_id
    AND private.student_can_write_attempt(attempt_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND private.student_can_write_attempt(attempt_id, auth.uid())
    AND is_correct IS NULL
    AND points_awarded IS NULL
  );
CREATE POLICY "Reviewers read student answers" ON public.student_answers
  FOR SELECT USING (private.is_admin_or_reviewer(auth.uid()));
CREATE POLICY "Reviewers grade student answers" ON public.student_answers
  FOR UPDATE USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

CREATE POLICY "Students read own chapter analytics" ON public.chapter_analytics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Reviewers read chapter analytics" ON public.chapter_analytics
  FOR SELECT USING (private.is_admin_or_reviewer(auth.uid()));
CREATE POLICY "Reviewers manage chapter analytics" ON public.chapter_analytics
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

-- Lock down legacy answer-bearing tables from student/public queries.
DROP POLICY IF EXISTS "Auth read past" ON public.past_questions;
DROP POLICY IF EXISTS "Admins manage past" ON public.past_questions;
CREATE POLICY "Reviewers manage past questions" ON public.past_questions
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

DROP POLICY IF EXISTS "Auth read demo" ON public.demo_questions;
DROP POLICY IF EXISTS "Admins manage demo" ON public.demo_questions;
CREATE POLICY "Reviewers manage demo questions" ON public.demo_questions
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

DROP POLICY IF EXISTS "Users view own generated" ON public.generated_questions;
DROP POLICY IF EXISTS "Admins manage generated" ON public.generated_questions;
CREATE POLICY "Reviewers manage generated questions" ON public.generated_questions
  FOR ALL USING (private.is_admin_or_reviewer(auth.uid()))
  WITH CHECK (private.is_admin_or_reviewer(auth.uid()));

-- Explicit grants keep students away from answer-bearing columns while RLS
-- decides which authenticated users can write admin/reviewer data.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles, public.app_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_types, public.classes, public."groups", public.subjects, public.chapters, public.boards TO authenticated;
REVOKE SELECT ON public.questions FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, exam_type_id, class_id, group_id, subject_id, chapter_id, board_id, board_year, question_type, difficulty, question_text, source, marks, status, is_active, created_at, updated_at)
  ON public.questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attempts, public.mock_exam_sessions, public.student_answers TO authenticated;
GRANT SELECT ON public.mock_exams, public.mock_exam_questions, public.chapter_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_drafts, public.admin_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_exams, public.mock_exam_questions TO authenticated;

-- Legacy answer-bearing content tables are still usable by reviewers/admins,
-- but students cannot read them because their RLS policies never match.
REVOKE ALL ON public.past_questions, public.demo_questions, public.generated_questions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.past_questions, public.demo_questions, public.generated_questions TO authenticated;

-- Triggers for updated_at fields on Phase 2 tables.
DROP TRIGGER IF EXISTS set_updated_at_exam_types ON public.exam_types;
CREATE TRIGGER set_updated_at_exam_types
  BEFORE UPDATE ON public.exam_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_classes ON public.classes;
CREATE TRIGGER set_updated_at_classes
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_groups ON public."groups";
CREATE TRIGGER set_updated_at_groups
  BEFORE UPDATE ON public."groups"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_boards ON public.boards;
CREATE TRIGGER set_updated_at_boards
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_question_options ON public.question_options;
CREATE TRIGGER set_updated_at_question_options
  BEFORE UPDATE ON public.question_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_question_drafts ON public.question_drafts;
CREATE TRIGGER set_updated_at_question_drafts
  BEFORE UPDATE ON public.question_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_mock_exams ON public.mock_exams;
CREATE TRIGGER set_updated_at_mock_exams
  BEFORE UPDATE ON public.mock_exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_attempts ON public.attempts;
CREATE TRIGGER set_updated_at_attempts
  BEFORE UPDATE ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_mock_exam_sessions ON public.mock_exam_sessions;
CREATE TRIGGER set_updated_at_mock_exam_sessions
  BEFORE UPDATE ON public.mock_exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_student_answers ON public.student_answers;
CREATE TRIGGER set_updated_at_student_answers
  BEFORE UPDATE ON public.student_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_chapter_analytics ON public.chapter_analytics;
CREATE TRIGGER set_updated_at_chapter_analytics
  BEFORE UPDATE ON public.chapter_analytics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_app_roles_user_role ON public.app_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_subjects_exam_group ON public.subjects(exam_type_id, group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapters_subject_order ON public.chapters(subject_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_status ON public.questions(chapter_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_questions_subject_status ON public.questions(subject_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON public.question_options(question_id, display_order);
CREATE INDEX IF NOT EXISTS idx_question_drafts_status ON public.question_drafts(status, subject_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_draft ON public.admin_reviews(draft_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_user_status ON public.attempts(user_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_user_status ON public.mock_exam_sessions(user_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt ON public.student_answers(attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_chapter_analytics_user ON public.chapter_analytics(user_id, chapter_id);
