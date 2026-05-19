import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { toBnDigits, toBnOptionLabel, formatDuration } from "@/lib/bn";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  Loader2,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";

type PracticeMode = "chapter" | "board" | "ai" | "mixed";
const MODE_META: Record<PracticeMode, { label: string; bn: string }> = {
  chapter: { label: "অধ্যায়ভিত্তিক", bn: "Chapter Practice" },
  board: { label: "বোর্ড প্রশ্ন", bn: "Past Board Questions" },
  ai: { label: "এআই প্রশ্ন", bn: "AI Generated" },
  mixed: { label: "মিশ্র প্রস্তুতি", bn: "Mixed Exam Prep" },
};

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    chapterId: typeof search.chapterId === "string" ? search.chapterId : undefined,
    mode: (["chapter", "board", "ai", "mixed"] as const).includes(search.mode as PracticeMode)
      ? (search.mode as PracticeMode)
      : ("chapter" as PracticeMode),
  }),
  component: PracticePage,
});

type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  name_bn: string | null;
  order_index?: number | null;
};

type Subject = {
  id: string;
  name: string;
  name_bn?: string | null;
};

type PracticeQuestion = {
  id: string;
  chapter_id: string;
  question_type: string;
  difficulty: string | null;
  question_text: string;
  marks: number | string | null;
  board?: string | null;
  year?: number | string | null;
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
  const { chapterId, mode } = Route.useSearch();
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
  const [elapsed, setElapsed] = useState(0);

  // Stopwatch — UI only
  const startedAtRef = useRef<number>(Date.now());
  useEffect(() => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [chapterId, mode]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentOptions = useMemo(
    () => options.filter((option) => option.question_id === currentQuestion?.id),
    [currentQuestion?.id, options],
  );
  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + Number(q.marks ?? 1), 0),
    [questions],
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
        .select("id, subject_id, name, name_bn, order_index")
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
          .select("id, name, name_bn")
          .eq("id", chapterRow.subject_id)
          .eq("is_active", true)
          .maybeSingle(),
        fetchApprovedQuestions(chapterId!),
      ]);

      if (!alive) return;
      if (questionResult.error) {
        setError(questionResult.error.message);
        setLoading(false);
        return;
      }

      const safeQuestions = questionResult.rows;
      const questionIds = safeQuestions.map((q) => q.id);
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
      const generated = (await generateInstantPracticeQuestions({
        data: { chapter_id: chapterId, count: 5, difficulty: "easy" },
      })) as { questions?: PracticeQuestion[]; options?: QuestionOption[] };

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

  const modeMeta = MODE_META[(mode as PracticeMode) ?? "chapter"];

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <Link to="/subjects" className="hover:text-foreground">বিষয়সমূহ</Link>
          <span className="mx-2">/</span>
          {subject ? (
            <a
              href={`/chapters?subjectId=${subject.id}`}
              className="hover:text-foreground"
            >
              {subject.name}
            </a>
          ) : (
            <span>অধ্যায়সমূহ</span>
          )}
          <span className="mx-2">/</span>
          <span className="text-foreground">অনুশীলন</span>
        </nav>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            সেশন যাচাই হচ্ছে…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">লগইন প্রয়োজন</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              যাচাইকৃত প্রশ্ন দেখতে ও ইতিহাস সংরক্ষণ করতে লগইন করুন।
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">লগইন / সাইন আপ</Link>
            </Button>
          </Card>
        ) : !chapterId ? (
          <Card className="paper-sheet p-8 text-center">
            <BookOpenText className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">আগে একটি অধ্যায় বেছে নিন</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              অনুশীলন শুরু হয় অধ্যায় থেকে। বিষয় → অধ্যায় → মোড — এই ক্রমে এগিয়ে যান।
            </p>
            <Button asChild className="mt-6">
              <Link to="/subjects">বিষয় বেছে নিন</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            প্রশ্ন লোড হচ্ছে…
          </Card>
        ) : error && questions.length === 0 ? (
          <Card className="paper-sheet p-6">
            <h2 className="flex items-center gap-2 font-semibold text-destructive">
              <AlertCircle className="h-5 w-5" />
              অনুশীলন লোড করা যায়নি
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : questions.length === 0 ? (
          <Card className="paper-sheet p-8 text-center">
            <FileQuestion className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="exam-heading text-xl font-semibold">
              {mode === "board"
                ? "এখনো কোনো বোর্ড প্রশ্ন নেই"
                : "এখনো কোনো যাচাইকৃত এমসিকিউ নেই"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              এই অধ্যায়ের জন্য এআই এমসিকিউ তৈরি করুন, বা অধ্যায় তালিকায় ফিরে যান।
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={generateAiQuestions} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> তৈরি হচ্ছে</>
                ) : (
                  <><Sparkles className="mr-1 h-4 w-4" /> এআই এমসিকিউ তৈরি করুন</>
                )}
              </Button>
              <Button asChild variant="outline">
                <a href={`/chapters?subjectId=${chapter?.subject_id ?? ""}`}>
                  অধ্যায়ে ফিরে যান
                </a>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Exam-paper sheet */}
            <Card className="paper-sheet overflow-hidden">
              {/* Paper header — exam style */}
              <div className="paper-divider border-b-2 px-6 pt-6 pb-4">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    AI Prep Partner · এইচএসসি অনুশীলন
                  </p>
                  <h1 className="exam-heading mt-1 text-2xl font-bold sm:text-3xl">
                    {subject?.name ?? "HSC Subject"}
                  </h1>
                  {subject?.name_bn ? (
                    <p className="text-sm text-muted-foreground">{subject.name_bn}</p>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Field label="Chapter" value={chapter?.name ?? "—"} />
                  <Field
                    label="Paper · মোড"
                    value={`${modeMeta.label} · ${modeMeta.bn}`}
                  />
                  <Field
                    label="Marks · নম্বর"
                    value={`${toBnDigits(totalMarks)} / ${totalMarks}`}
                  />
                  <Field
                    label="Time · সময়"
                    value={formatDuration(elapsed)}
                    icon={<Timer className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Progress strip */}
              <div className="border-b bg-muted/30 px-6 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Question {toBnDigits(currentIndex + 1)} / {toBnDigits(questions.length)}
                  </span>
                  <span>
                    {currentQuestion?.difficulty ? (
                      <Badge variant="outline" className="text-xs">
                        {currentQuestion.difficulty}
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <Progress value={progressValue} className="mt-2 h-1.5" />
              </div>

              {/* Question body */}
              <div className="px-6 py-6">
                <div className="flex items-baseline gap-3">
                  <span className="exam-heading text-lg font-bold">
                    {toBnDigits(currentIndex + 1)}.
                  </span>
                  <h2 className="exam-heading text-lg font-semibold leading-7">
                    {currentQuestion!.question_text}
                  </h2>
                </div>

                {/* OMR-style option grid */}
                <div className="mt-5 space-y-2">
                  {currentOptions.map((option, idx) => {
                    const selected = selectedOptionId === option.id;
                    const showResult = !!result;
                    const isThisCorrect =
                      showResult && result!.isCorrect && selected;
                    const isThisWrong =
                      showResult && !result!.isCorrect && selected;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!!result || submitting}
                        onClick={() => setSelectedOptionId(option.id)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-lg border bg-white px-4 py-3 text-left transition",
                          selected
                            ? "border-foreground shadow-sm"
                            : "border-input hover:border-foreground/40 hover:bg-muted/40",
                          showResult && "opacity-90",
                        )}
                      >
                        <span
                          className={cn(
                            "omr-bubble",
                            selected && !showResult && "omr-bubble--selected",
                            isThisCorrect && "omr-bubble--correct",
                            isThisWrong && "omr-bubble--wrong",
                          )}
                        >
                          {toBnOptionLabel(option.option_key, idx)}
                        </span>
                        <span className="flex-1 text-sm sm:text-base">
                          {option.option_text}
                        </span>
                        <span className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:inline">
                          {option.option_key}
                        </span>
                      </button>
                    );
                  })}
                  {currentOptions.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      This approved question does not have public answer options yet.
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                {result ? (
                  <div
                    className={cn(
                      "mt-5 rounded-lg border p-4",
                      result.isCorrect
                        ? "border-success/40 bg-success/10"
                        : "border-destructive/40 bg-destructive/10",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {result.isCorrect ? (
                        <CheckCircle2 className="mt-0.5 h-6 w-6 text-success" />
                      ) : (
                        <XCircle className="mt-0.5 h-6 w-6 text-destructive" />
                      )}
                      <div>
                        <h3 className="exam-heading font-semibold">
                          {result.isCorrect ? "সঠিক · Correct" : "ভুল · Incorrect"}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          You scored {toBnDigits(result.score)} / {toBnDigits(result.maxScore)} on
                          this question.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer actions */}
              <div className="paper-divider flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
                <div className="text-xs text-muted-foreground">
                  Answers are saved only after you submit. Correct answers stay hidden until then.
                </div>
                <div className="flex flex-wrap gap-2">
                  {!result ? (
                    <Button
                      onClick={submitAnswer}
                      disabled={
                        !selectedOptionId || submitting || currentOptions.length === 0
                      }
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting</>
                      ) : (
                        "Submit Answer · জমা দিন"
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline">
                        <a href={`/result/${result.attemptId}`}>View Result · ফলাফল</a>
                      </Button>
                      {currentIndex < questions.length - 1 ? (
                        <Button onClick={goToNextQuestion}>
                          Next · পরবর্তী <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Side helpers */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                size="sm"
                onClick={generateAiQuestions}
                disabled={generating}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating</>
                ) : (
                  <><Sparkles className="mr-1 h-4 w-4" /> Generate more AI MCQs</>
                )}
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/chapters?subjectId=${chapter?.subject_id ?? ""}`}>
                  Change chapter
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/history">History</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-white/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
