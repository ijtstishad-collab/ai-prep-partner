
-- Move readiness function to private schema and revoke public execute
DROP FUNCTION IF EXISTS public.compute_chapter_readiness(uuid);

CREATE OR REPLACE FUNCTION private.compute_chapter_readiness(_chapter_id uuid)
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

REVOKE ALL ON FUNCTION private.compute_chapter_readiness(uuid) FROM PUBLIC, anon, authenticated;
