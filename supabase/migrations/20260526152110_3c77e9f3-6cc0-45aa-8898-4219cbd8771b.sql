
-- Extend past_questions
ALTER TABLE public.past_questions
  ADD COLUMN IF NOT EXISTS exam_level text,
  ADD COLUMN IF NOT EXISTS paper text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'official_board',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS explanation_bn text,
  ADD COLUMN IF NOT EXISTS options jsonb,
  ADD COLUMN IF NOT EXISTS pattern_id uuid;

-- Question patterns
CREATE TABLE IF NOT EXISTS public.question_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  name text NOT NULL,
  name_bn text,
  description_bn text,
  appeared_years integer[] NOT NULL DEFAULT '{}',
  appeared_boards text[] NOT NULL DEFAULT '{}',
  frequency_count integer NOT NULL DEFAULT 0,
  priority_score integer NOT NULL DEFAULT 0,
  priority_label text NOT NULL DEFAULT 'practice_later',
  topic_importance integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.question_patterns TO authenticated;
GRANT ALL ON public.question_patterns TO service_role;

ALTER TABLE public.question_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read patterns" ON public.question_patterns;
CREATE POLICY "Auth read patterns" ON public.question_patterns
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage patterns" ON public.question_patterns;
CREATE POLICY "Admins manage patterns" ON public.question_patterns
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Priority scoring
CREATE OR REPLACE FUNCTION public.compute_priority_score(
  p_frequency integer,
  p_latest_year integer,
  p_distinct_boards integer,
  p_topic_importance integer
) RETURNS integer
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  freq_pts integer := LEAST(40, COALESCE(p_frequency,0) * 10);
  recency_pts integer := 0;
  board_pts integer := LEAST(20, COALESCE(p_distinct_boards,0) * 5);
  topic_pts integer := ROUND(COALESCE(p_topic_importance,50) * 0.15);
  current_yr integer := EXTRACT(YEAR FROM now())::integer;
BEGIN
  IF p_latest_year IS NOT NULL THEN
    IF current_yr - p_latest_year <= 1 THEN recency_pts := 25;
    ELSIF current_yr - p_latest_year <= 3 THEN recency_pts := 18;
    ELSIF current_yr - p_latest_year <= 5 THEN recency_pts := 10;
    ELSE recency_pts := 4;
    END IF;
  END IF;
  RETURN LEAST(100, freq_pts + recency_pts + board_pts + topic_pts);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_pattern_stats() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pid uuid := COALESCE(NEW.pattern_id, OLD.pattern_id);
  yrs integer[];
  bds text[];
  freq integer;
  latest integer;
  distinct_b integer;
  topic_imp integer;
  score integer;
  label text;
BEGIN
  IF pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COALESCE(array_agg(DISTINCT year) FILTER (WHERE year IS NOT NULL), '{}'),
    COALESCE(array_agg(DISTINCT board) FILTER (WHERE board IS NOT NULL), '{}'),
    COUNT(*),
    MAX(year),
    COUNT(DISTINCT board)
  INTO yrs, bds, freq, latest, distinct_b
  FROM public.past_questions WHERE pattern_id = pid;

  SELECT topic_importance INTO topic_imp FROM public.question_patterns WHERE id = pid;
  score := public.compute_priority_score(freq::int, latest, distinct_b::int, COALESCE(topic_imp,50));
  label := CASE WHEN score >= 70 THEN 'very_important'
                WHEN score >= 40 THEN 'important'
                ELSE 'practice_later' END;

  UPDATE public.question_patterns
  SET appeared_years = yrs,
      appeared_boards = bds,
      frequency_count = freq,
      priority_score = score,
      priority_label = label
  WHERE id = pid;

  -- Propagate score to all member questions
  UPDATE public.past_questions SET priority_score = score WHERE pattern_id = pid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_pattern_stats ON public.past_questions;
CREATE TRIGGER trg_refresh_pattern_stats
AFTER INSERT OR UPDATE OR DELETE ON public.past_questions
FOR EACH ROW EXECUTE FUNCTION public.refresh_pattern_stats();

CREATE INDEX IF NOT EXISTS idx_past_questions_pattern ON public.past_questions(pattern_id);
CREATE INDEX IF NOT EXISTS idx_past_questions_chapter ON public.past_questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_patterns_chapter ON public.question_patterns(chapter_id);
