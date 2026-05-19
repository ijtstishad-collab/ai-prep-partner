import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toBnDigits, toBnOptionLabel, formatDuration } from "@/lib/bn";
import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Sparkles,
  TrendingDown,
  Trophy,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/result/$attemptId")({ component: ResultPage });

type Attempt = {
  id: string;
  status: string;
  score: number | string | null;
  max_score: number | string | null;
  total_questions: number | null;
  correct_count: number | null;
  submitted_at: string | null;
  started_at?: string | null;
  chapter_id: string | null;
  subject_id: string | null;
};

type StudentAnswer = {
  id: string;
  question_id: string;
  question_option_id: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  points_awarded: number | string | null;
};

type Question = {
  id: string;
  question_text: string;
};

type Chapter = {
  id: string;
  name: string;
  name_bn: string | null;
  subject_id: string;
  order_index: number | null;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

function ResultPage() {
  const { attemptId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [nextChapter, setNextChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = Number(attempt?.score ?? 0);
  const maxScore = Number(attempt?.max_score ?? 0);
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const correctCount = attempt?.correct_count ?? answers.filter((a) => a.is_correct).length;
  const totalQuestions = attempt?.total_questions ?? answers.length;
  const wrongCount = Math.max(0, totalQuestions - correctCount);

  const elapsedSeconds = useMemo(() => {
    if (!attempt?.started_at || !attempt?.submitted_at) return 0;
    const s = new Date(attempt.started_at).getTime();
    const e = new Date(attempt.submitted_at).getTime();
    return Math.max(0, Math.floor((e - s) / 1000));
  }, [attempt?.started_at, attempt?.submitted_at]);

  const verdict = useMemo(() => {
    if (scorePercent >= 80) return { label: "চমৎকার", tone: "success" as const };
    if (scorePercent >= 50) return { label: "ভালো", tone: "primary" as const };
    if (scorePercent >= 30) return { label: "আরও চর্চা দরকার", tone: "warning" as const };
    return { label: "দুর্বল — পুনরায় চেষ্টা করুন", tone: "destructive" as const };
  }, [scorePercent]);

  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

  useEffect(() => {
    if (!user) return;

    let alive = true;

    async function loadResult() {
      setLoading(true);
      setError(null);

      const { data: attemptRow, error: attemptError } = await fromTable("attempts")
        .select(
          "id, status, score, max_score, total_questions, correct_count, submitted_at, started_at, chapter_id, subject_id",
        )
        .eq("id", attemptId)
        .maybeSingle();

      if (!alive) return;
      if (attemptError) {
        setError(attemptError.message);
        setLoading(false);
        return;
      }
      if (!attemptRow) {
        setAttempt(null);
        setAnswers([]);
        setQuestions([]);
        setLoading(false);
        return;
      }

      const { data: answerRows, error: answerError } = await fromTable("student_answers")
        .select("id, question_id, question_option_id, answer_text, is_correct, points_awarded")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true });

      if (!alive) return;
      if (answerError) {
        setError(answerError.message);
        setLoading(false);
        return;
      }

      const safeAnswers = (answerRows ?? []) as StudentAnswer[];
      const questionIds = safeAnswers.map((a) => a.question_id);
      let questionRows: Question[] = [];

      if (questionIds.length > 0) {
        const { data, error: qErr } = await fromTable("questions")
          .select("id, question_text")
          .in("id", questionIds)
          .eq("status", "approved")
          .eq("is_active", true);
        if (!alive) return;
        if (qErr) {
          setError(qErr.message);
          setLoading(false);
          return;
        }
        questionRows = (data ?? []) as Question[];
      }

      // Load chapter + next chapter for "recommended next" hint
      let chapterRow: Chapter | null = null;
      let nextChapterRow: Chapter | null = null;
      if (attemptRow.chapter_id) {
        const { data: ch } = await fromTable("chapters")
          .select("id, name, name_bn, subject_id, order_index")
          .eq("id", attemptRow.chapter_id)
          .maybeSingle();
        chapterRow = (ch as Chapter | null) ?? null;
        if (chapterRow) {
          const { data: nextRows } = await fromTable("chapters")
            .select("id, name, name_bn, subject_id, order_index")
            .eq("subject_id", chapterRow.subject_id)
            .eq("is_active", true)
            .gt("order_index", chapterRow.order_index ?? 0)
            .order("order_index", { ascending: true })
            .limit(1);
          nextChapterRow = ((nextRows ?? [])[0] as Chapter | undefined) ?? null;
        }
      }

      if (!alive) return;
      setAttempt(attemptRow as Attempt);
      setAnswers(safeAnswers);
      setQuestions(questionRows);
      setChapter(chapterRow);
      setNextChapter(nextChapterRow);
      setLoading(false);
    }

    loadResult();
    return () => {
      alive = false;
    };
  }, [attemptId, user]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> সেশন যাচাই হচ্ছে…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="exam-heading text-2xl font-bold">লগইন প্রয়োজন</h1>
            <Button asChild className="mt-6">
              <Link to="/auth">লগইন / সাইন আপ</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> ফলাফল লোড হচ্ছে…
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h1 className="font-semibold text-destructive">ফলাফল লোড করা যায়নি</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : !attempt ? (
          <Card className="paper-sheet p-8 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="exam-heading text-2xl font-bold">ফলাফল পাওয়া যায়নি</h1>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/history">ইতিহাস দেখুন</Link>
            </Button>
          </Card>
        ) : attempt.status !== "submitted" ? (
          <Card className="paper-sheet p-8 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="exam-heading text-2xl font-bold">ফলাফল দেখতে জমা দিন</h1>
          </Card>
        ) : (
          <div className="space-y-5">
            {/* Score sheet */}
            <Card className="paper-sheet overflow-hidden">
              <div className="paper-divider border-b-2 px-6 pt-6 pb-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  এআই প্রেপ পার্টনার · ফলাফল
                </p>
                <h1 className="exam-heading mt-1 text-2xl font-bold">
                  {chapter?.name ?? "অনুশীলনের ফলাফল"}
                </h1>
                {chapter?.name_bn ? (
                  <p className="text-sm text-muted-foreground">{chapter.name_bn}</p>
                ) : null}
              </div>

              <div className="grid gap-4 px-6 py-6 sm:grid-cols-4">
                <Stat
                  label="নম্বর"
                  value={`${toBnDigits(score)} / ${toBnDigits(maxScore)}`}
                  hint={`${scorePercent}%`}
                  icon={<Trophy className="h-4 w-4" />}
                />
                <Stat
                  label="সঠিক"
                  value={toBnDigits(correctCount)}
                  hint={`মোট ${toBnDigits(totalQuestions)}`}
                  icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                />
                <Stat
                  label="ভুল"
                  value={toBnDigits(wrongCount)}
                  hint={`মোট ${toBnDigits(totalQuestions)}`}
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                />
                <Stat
                  label="ব্যয়িত সময়"
                  value={elapsedSeconds > 0 ? formatDuration(elapsedSeconds) : "—"}
                  hint="elapsed"
                />
              </div>

              <div className="px-6 pb-6">
                <div className="mb-2 flex items-center justify-between">
                  <Badge
                    className={cn(
                      verdict.tone === "success" && "bg-success text-success-foreground",
                      verdict.tone === "warning" && "bg-warning text-warning-foreground",
                      verdict.tone === "destructive" &&
                        "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {verdict.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{scorePercent}%</span>
                </div>
                <Progress value={scorePercent} />
              </div>
            </Card>

            {/* Weak topic + next */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="paper-sheet p-5">
                <div className="flex items-start gap-3">
                  <TrendingDown className="mt-0.5 h-5 w-5 text-warning" />
                  <div>
                    <h3 className="exam-heading font-semibold">দুর্বল দিক</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {wrongCount === 0
                        ? "এই সেটে কোনো দুর্বলতা নেই — গতি ধরে রাখুন!"
                        : `${chapter?.name ?? "এই অধ্যায়"}-এ ${toBnDigits(wrongCount)} টি প্রশ্ন ভুল হয়েছে। অধ্যায়টি আরেকবার পড়ে দেখুন।`}
                    </p>
                    {attempt.chapter_id ? (
                      <Button asChild size="sm" variant="outline" className="mt-3">
                        <a href={`/practice?chapterId=${attempt.chapter_id}`}>আবার অনুশীলন করুন</a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card className="paper-sheet p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="exam-heading font-semibold">পরবর্তী অধ্যায়</h3>
                    {nextChapter ? (
                      <>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {nextChapter.name}
                          {nextChapter.name_bn ? ` · ${nextChapter.name_bn}` : ""}
                        </p>
                        <Button asChild size="sm" className="mt-3">
                          <a href={`/practice?chapterId=${nextChapter.id}`}>
                            পরবর্তী অধ্যায় শুরু করুন
                          </a>
                        </Button>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        এই বিষয়ের অধ্যায় শেষ — এবার একটি মক টেস্ট দিন।
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Per-question review */}
            <div className="space-y-2">
              <h2 className="exam-heading px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                উত্তর পর্যালোচনা
              </h2>
              {answers.map((answer, index) => {
                const question = questionById.get(answer.question_id);
                return (
                  <Card key={answer.id} className="paper-sheet p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "omr-bubble shrink-0",
                          answer.is_correct
                            ? "omr-bubble--correct"
                            : "omr-bubble--wrong",
                        )}
                        style={{ width: "1.75rem", height: "1.75rem" }}
                      >
                        {toBnDigits(index + 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {question?.question_text ?? "প্রশ্নের লেখা পাওয়া যায়নি"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>আপনার উত্তর: {answer.answer_text ?? "—"}</span>
                          <span>
                            {toBnDigits(Number(answer.points_awarded ?? 0))} নম্বর
                          </span>
                          <Badge
                            variant={answer.is_correct ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {answer.is_correct ? "সঠিক" : "ভুল"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/history">ইতিহাস দেখুন</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/analytics">বিশ্লেষণ দেখুন</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white/60 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="exam-heading mt-1 text-xl font-bold">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
