import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle2, GraduationCap, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/result/$attemptId")({ component: ResultPage });

type Attempt = {
  id: string;
  status: string;
  score: number | string | null;
  max_score: number | string | null;
  total_questions: number | null;
  correct_count: number | null;
  submitted_at: string | null;
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

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

function ResultPage() {
  const { attemptId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = Number(attempt?.score ?? 0);
  const maxScore = Number(attempt?.max_score ?? 0);
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
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
          "id, status, score, max_score, total_questions, correct_count, submitted_at, chapter_id, subject_id",
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
      const questionIds = safeAnswers.map((answer) => answer.question_id);
      let questionRows: Question[] = [];

      if (questionIds.length > 0) {
        const { data, error: questionError } = await fromTable("questions")
          .select("id, question_text")
          .in("id", questionIds)
          .eq("status", "approved")
          .eq("is_active", true);

        if (!alive) return;
        if (questionError) {
          setError(questionError.message);
          setLoading(false);
          return;
        }
        questionRows = (data ?? []) as Question[];
      }

      setAttempt(attemptRow as Attempt);
      setAnswers(safeAnswers);
      setQuestions(questionRows);
      setLoading(false);
    }

    loadResult();

    return () => {
      alive = false;
    };
  }, [attemptId, user]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl px-4 py-10">
        {authLoading ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking your student session...
          </Card>
        ) : !user ? (
          <Card className="p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold">Login required</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Sign in to view your own submitted practice result.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading result...
          </Card>
        ) : error ? (
          <Card className="p-6">
            <h1 className="font-semibold text-destructive">Could not load result</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : !attempt ? (
          <Card className="p-8 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Result not found</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              This result is unavailable or does not belong to your account.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/history">Open History</Link>
            </Button>
          </Card>
        ) : attempt.status !== "submitted" ? (
          <Card className="p-8 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold">Result available after submission</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              This attempt has not been submitted yet, so the score is still hidden.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card className="p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Practice Result</p>
                  <h1 className="mt-1 text-3xl font-bold">
                    {score} / {maxScore}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {attempt.correct_count ?? 0} correct out of{" "}
                    {attempt.total_questions ?? answers.length} question
                    {attempt.total_questions === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant={scorePercent >= 50 ? "default" : "secondary"}>
                  {scorePercent}% score
                </Badge>
              </div>
              <div className="mt-6">
                <Progress value={scorePercent} />
              </div>
            </Card>

            <div className="space-y-3">
              {answers.map((answer, index) => {
                const question = questionById.get(answer.question_id);
                return (
                  <Card key={answer.id} className="p-5">
                    <div className="flex items-start gap-3">
                      {answer.is_correct ? (
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <XCircle className="mt-1 h-5 w-5 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Question {index + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {Number(answer.points_awarded ?? 0)} point
                            {Number(answer.points_awarded ?? 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <h2 className="font-semibold">
                          {question?.question_text ?? "Question text unavailable"}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Your answer: {answer.answer_text ?? "No answer recorded"}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              {attempt.chapter_id ? (
                <Button asChild>
                  <a href={`/practice?chapterId=${attempt.chapter_id}`}>Practice Again</a>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/history">Open History</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
