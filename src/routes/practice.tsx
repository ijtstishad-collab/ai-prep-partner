import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateInstantPracticeQuestions } from "@/lib/instant-practice-ai.functions";
import { submitPracticeAnswer } from "@/lib/practice.functions";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  Loader2,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    chapterId: typeof search.chapterId === "string" ? search.chapterId : undefined,
  }),
  component: PracticePage,
});

type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  name_bn: string | null;
};

type Subject = {
  id: string;
  name: string;
};

type PracticeQuestion = {
  id: string;
  chapter_id: string;
  question_type: string;
  difficulty: string | null;
  question_text: string;
  marks: number | string | null;
};

type QuestionOption = {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  display_order: number;
};

type SubmissionResult = {
  attemptId: string;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  selectedAnswer: string;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

const schemaMismatchPattern =
  /(column .* does not exist|schema cache|status|is_active|marks|is_approved)/i;
const ignorableLegacyPattern =
  /(permission denied|column .* does not exist|schema cache|is_approved)/i;

const uniqueById = (rows: PracticeQuestion[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
};

async function fetchLegacyApprovedQuestions(chapterId: string) {
  const { data, error } = await fromTable("questions")
    .select("id, chapter_id, question_type, difficulty, question_text")
    .eq("chapter_id", chapterId)
    .eq("is_approved", true)
    .eq("question_type", "mcq")
    .order("created_at", { ascending: true })
    .limit(25);

  return {
    rows: ((data ?? []) as PracticeQuestion[]).map((row) => ({
      ...row,
      marks: row.marks ?? 1,
    })),
    error,
  };
}

async function fetchApprovedQuestions(chapterId: string) {
  const { data, error } = await fromTable("questions")
    .select("id, chapter_id, question_type, difficulty, question_text, marks")
    .eq("chapter_id", chapterId)
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("question_type", "mcq")
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) {
    if (schemaMismatchPattern.test(error.message)) {
      const legacy = await fetchLegacyApprovedQuestions(chapterId);
      return {
        rows: legacy.rows,
        error:
          legacy.error && !ignorableLegacyPattern.test(legacy.error.message) ? legacy.error : null,
      };
    }

    return { rows: [] as PracticeQuestion[], error };
  }

  const phase2Rows = (data ?? []) as PracticeQuestion[];
  if (phase2Rows.length > 0) {
    return { rows: phase2Rows, error: null };
  }

  const legacy = await fetchLegacyApprovedQuestions(chapterId);
  if (legacy.error && !ignorableLegacyPattern.test(legacy.error.message)) {
    return { rows: [] as PracticeQuestion[], error: legacy.error };
  }

  return { rows: uniqueById([...phase2Rows, ...legacy.rows]), error: null };
}

function PracticePage() {
  const { chapterId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentOptions = useMemo(
    () => options.filter((option) => option.question_id === currentQuestion?.id),
    [currentQuestion?.id, options],
  );
  const progressValue =
    questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  useEffect(() => {
    if (!user || !chapterId) {
      setChapter(null);
      setSubject(null);
      setQuestions([]);
      setOptions([]);
      return;
    }

    let alive = true;

    async function loadPractice() {
      setLoading(true);
      setError(null);
      setResult(null);
      setSelectedOptionId(null);
      setCurrentIndex(0);

      const { data: chapterRow, error: chapterError } = await fromTable("chapters")
        .select("id, subject_id, name, name_bn")
        .eq("id", chapterId)
        .eq("is_active", true)
        .maybeSingle();

      if (!alive) return;
      if (chapterError) {
        setError(chapterError.message);
        setLoading(false);
        return;
      }
      if (!chapterRow) {
        setError("This chapter is not available for practice.");
        setLoading(false);
        return;
      }

      const [{ data: subjectRow }, questionResult] = await Promise.all([
        fromTable("subjects")
          .select("id, name")
          .eq("id", chapterRow.subject_id)
          .eq("is_active", true)
          .maybeSingle(),
        fetchApprovedQuestions(chapterId),
      ]);

      if (!alive) return;
      if (questionResult.error) {
        setError(questionResult.error.message);
        setLoading(false);
        return;
      }

      const safeQuestions = questionResult.rows;
      const questionIds = safeQuestions.map((question) => question.id);
      let optionRows: QuestionOption[] = [];

      if (questionIds.length > 0) {
        const { data, error: optionError } = await fromTable("question_options")
          .select("id, question_id, option_key, option_text, display_order")
          .in("question_id", questionIds)
          .order("display_order", { ascending: true });

        if (!alive) return;
        if (optionError) {
          setError(optionError.message);
          setLoading(false);
          return;
        }
        optionRows = (data ?? []) as QuestionOption[];
      }

      setChapter(chapterRow as Chapter);
      setSubject((subjectRow as Subject | null) ?? null);
      setQuestions(safeQuestions);
      setOptions(optionRows);
      setLoading(false);
    }

    loadPractice();

    return () => {
      alive = false;
    };
  }, [chapterId, user]);

  const submitAnswer = async () => {
    if (!chapterId || !currentQuestion || !selectedOptionId || result) return;

    setSubmitting(true);
    setError(null);

    try {
      const submission = await submitPracticeAnswer({
        data: {
          chapter_id: chapterId,
          question_id: currentQuestion.id,
          question_option_id: selectedOptionId,
        },
      });
      setResult(submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const generateAiQuestions = async () => {
    if (!chapterId || generating) return;

    setGenerating(true);
    setError(null);
    setResult(null);
    setSelectedOptionId(null);

    try {
      const generated = await generateInstantPracticeQuestions({
        data: {
          chapter_id: chapterId,
          count: 5,
          difficulty: "easy",
        },
      });

      setQuestions((generated.questions ?? []) as PracticeQuestion[]);
      setOptions((generated.options ?? []) as QuestionOption[]);
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate AI practice questions.");
    } finally {
      setGenerating(false);
    }
  };

  const goToNextQuestion = () => {
    setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
    setSelectedOptionId(null);
    setResult(null);
    setError(null);
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Practice</p>
          <h1 className="mt-1 text-3xl font-bold">Chapter-wise MCQ practice</h1>
          <p className="mt-2 text-muted-foreground">
            Approved questions load from Supabase. If a chapter is empty, AI can create instant
            practice MCQs for the student.
          </p>
        </div>

        {authLoading ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking your student session...
          </Card>
        ) : !user ? (
          <Card className="p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">Login required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Sign in to load approved questions and save your answer history.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : !chapterId ? (
          <Card className="p-8 text-center">
            <BookOpenText className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">Choose a chapter first</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Practice starts from a chapter so the platform can save chapter-level analytics later.
            </p>
            <Button asChild className="mt-6">
              <Link to="/chapters">Open Chapters</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading approved questions...
          </Card>
        ) : error && !currentQuestion ? (
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold text-destructive">
              <AlertCircle className="h-5 w-5" />
              Could not load practice
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : questions.length === 0 ? (
          <Card className="p-8 text-center">
            <FileQuestion className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No approved MCQs yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Generate instant AI MCQs for this student session, or return to chapters.
            </p>
            {error ? (
              <p className="mx-auto mt-4 max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={generateAiQuestions} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  "Generate AI MCQs"
                )}
              </Button>
              <Button asChild variant="outline">
                <a href={`/chapters?subjectId=${chapter?.subject_id ?? ""}`}>Back to Chapters</a>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.75fr]">
            <Card className="p-6">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {subject ? <Badge>{subject.name}</Badge> : null}
                {chapter ? <Badge variant="secondary">{chapter.name}</Badge> : null}
                {currentQuestion?.difficulty ? (
                  <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                ) : null}
              </div>

              <div className="mb-5">
                <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                  <span>
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span>{Number(currentQuestion?.marks ?? 1)} mark</span>
                </div>
                <Progress value={progressValue} />
              </div>

              <div className="rounded-xl border p-5">
                <h2 className="text-lg font-semibold leading-7">{currentQuestion.question_text}</h2>
                <div className="mt-5 grid gap-3">
                  {currentOptions.map((option) => {
                    const selected = selectedOptionId === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!!result || submitting}
                        onClick={() => setSelectedOptionId(option.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "hover:border-primary/50 hover:bg-muted",
                          result && selected ? "border-foreground" : "",
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {option.option_key}
                        </span>
                        <span>{option.option_text}</span>
                      </button>
                    );
                  })}
                  {currentOptions.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      This approved question does not have public answer options yet. Ask an admin
                      to publish options before students can submit it.
                    </p>
                  ) : null}
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              {result ? (
                <Card className="mt-5 border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    {result.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-6 w-6 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-6 w-6 text-destructive" />
                    )}
                    <div>
                      <h3 className="font-semibold">
                        {result.isCorrect ? "Correct answer" : "Answer submitted"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You scored {result.score} out of {result.maxScore}. Your selected answer was
                        saved to your attempt history.
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={submitAnswer}
                  disabled={
                    !selectedOptionId || submitting || !!result || currentOptions.length === 0
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting
                    </>
                  ) : (
                    "Submit Answer"
                  )}
                </Button>
                {result ? (
                  <>
                    <Button asChild variant="outline">
                      <a href={`/result/${result.attemptId}`}>View Result</a>
                    </Button>
                    {currentIndex < questions.length - 1 ? (
                      <Button variant="ghost" onClick={goToNextQuestion}>
                        Next Question <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold">Practice guardrails</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Approved MCQs load first; empty chapters can generate instant AI practice.</p>
                <p>Options are read from a separate table that has no correctness flag.</p>
                <p>Scoring happens only after submission through a protected server function.</p>
              </div>
              <Button
                className="mt-6 w-full"
                variant="secondary"
                onClick={generateAiQuestions}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  "Generate More AI MCQs"
                )}
              </Button>
              <Button asChild className="mt-6 w-full" variant="outline">
                <a href={`/chapters?subjectId=${chapter?.subject_id ?? ""}`}>
                  Choose Another Chapter
                </a>
              </Button>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
