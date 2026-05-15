CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated;

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone reads active subjects" ON public.subjects;
CREATE POLICY "Anyone reads active subjects" ON public.subjects
  FOR SELECT USING (is_active OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects" ON public.subjects
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone reads active chapters" ON public.chapters;
CREATE POLICY "Anyone reads active chapters" ON public.chapters
  FOR SELECT USING (is_active OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters" ON public.chapters
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated read approved questions" ON public.questions;
CREATE POLICY "Authenticated read approved questions" ON public.questions
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_approved OR private.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
CREATE POLICY "Admins manage questions" ON public.questions
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view attempts" ON public.test_attempts;
CREATE POLICY "Admins view attempts" ON public.test_attempts
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view answers" ON public.user_answers;
CREATE POLICY "Admins view answers" ON public.user_answers
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view performance" ON public.performance_summary;
CREATE POLICY "Admins view performance" ON public.performance_summary
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage reports" ON public.question_reports;
CREATE POLICY "Admins manage reports" ON public.question_reports
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;