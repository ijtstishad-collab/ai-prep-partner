CREATE TABLE public.question_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports" ON public.question_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own reports" ON public.question_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage reports" ON public.question_reports
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_question_reports_question ON public.question_reports(question_id);