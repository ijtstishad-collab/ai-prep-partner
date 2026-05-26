import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateInstantPracticeQuestions } from "@/lib/instant-practice-ai.functions";
import { submitPracticeAnswer } from "@/lib/practice.functions";
import { cn } from "@/lib/utils";
import { toBnDigits, toBnOptionLabel, formatDuration } from "@/lib/bn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
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
  options: unknown;
  correct_answer: string | null;
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
  correctAnswer?: string | null;
  correctText?: string | null;
  explanation?: string | null;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

const KEYS = ["A", "B", "C", "D", "E", "F"];

function deriveOptions(question: PracticeQuestion): QuestionOption[] {
  const raw = question.options;
  let entries: { key: string; text: string }[] = [];
  if (Array.isArray(raw)) {
    entries = raw.map((value, idx) => ({
      key: KEYS[idx] ?? String(idx + 1),
      text: typeof value === "string" ? value : JSON.stringify(value),
    }));
  } else if (raw && typeof raw === "object") {
    entries = Object.entries(raw as Record<string, unknown>).map(([k, v], idx) => ({
      key: KEYS[idx] ?? k,
      text: typeof v === "string" ? v : JSON.stringify(v),
    }));
  }
  return entries.map((entry, idx) => ({
    id: `${question.id}-${idx}`,
    question_id: question.id,
    option_key: entry.key,
    option_text: entry.text,
    display_order: idx,
  }));
}

async function fetchApprovedQuestions(chapterId: string) {
  const { data, error } = await fromTable("questions")
    .select(
      "id, chapter_id, question_type, difficulty, question_text, options, correct_answer",
    )
    .eq("chapter_id", chapterId)
    .eq("is_approved", true)
    .eq("question_type", "mcq")
    .order("created_at", { ascending: true });

  return { rows: (data ?? []) as PracticeQuestion[], error };
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
  const [genOpen, setGenOpen] = useState(false);
  const [genCount, setGenCount] = useState<5 | 10 | 20>(10);
  const [genDifficulty, setGenDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [genStyle, setGenStyle] = useState<"mcq" | "short" | "board">("mcq");
  const [genLanguage, setGenLanguage] = useState<"bn" | "en" | "mixed">("bn");

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
  const totalMarks = useMemo(() => questions.length, [questions]);

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
      const optionRows: QuestionOption[] = safeQuestions.flatMap(deriveOptions);

      setChapter(chapterRow as Chapter);
      setSubject((subjectRow as Subject | null) ?? null);
      setQuestions(safeQuestions);
      setOptions(optionRows);
      setLoading(false);

      // Auto-generate 10 Bangla MCQs when no verified questions exist — no extra clicks.
      if (safeQuestions.length === 0) {
        void generateAiQuestions({ count: 10, difficulty: "medium", question_style: "mcq", language: "bn" });
      }
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
      const selected = currentOptions.find((o) => o.id === selectedOptionId);
      if (!selected) throw new Error("Please select an answer.");
      const submission = await submitPracticeAnswer({
        data: {
          chapter_id: chapterId,
          question_id: currentQuestion.id,
          selected_answer: selected.option_text,
        },
      });
      setResult(submission);
      // Auto-advance to next question to reduce clicks
      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
          setSelectedOptionId(null);
          setResult(null);
        }, 1400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };


  const generateAiQuestions = async (overrides?: {
    count?: number;
    difficulty?: "easy" | "medium" | "hard";
    question_style?: "mcq" | "short" | "board";
    language?: "bn" | "en" | "mixed";
  }) => {
    if (!chapterId || generating) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setSelectedOptionId(null);

    try {
      const generated = (await generateInstantPracticeQuestions({
        data: {
          chapter_id: chapterId,
          count: overrides?.count ?? genCount,
          difficulty: overrides?.difficulty ?? genDifficulty,
          question_style: overrides?.question_style ?? genStyle,
          language: overrides?.language ?? genLanguage,
        },
      })) as unknown as { questions?: PracticeQuestion[] };

      const aiQuestions = (generated.questions ?? []) as PracticeQuestion[];
      setQuestions(aiQuestions);
      setOptions(aiQuestions.flatMap(deriveOptions));
      setCurrentIndex(0);
      setGenOpen(false);
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
      <div className="container mx-auto max-w-3xl px-4 py-6">


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
          <Card className="paper-sheet overflow-hidden">
            {/* Header skeleton */}
            <div className="paper-divider border-b-2 px-6 pt-6 pb-4">
              <div className="space-y-2 text-center">
                <Skeleton className="mx-auto h-3 w-48" />
                <Skeleton className="mx-auto h-7 w-64" />
                <Skeleton className="mx-auto h-4 w-40" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            </div>
            {/* Progress skeleton */}
            <div className="border-b bg-muted/30 px-6 py-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </div>
            {/* Question body skeleton */}
            <div className="px-6 py-6">
              <div className="flex items-baseline gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-5/6" />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            </div>
            {/* Footer skeleton */}
            <div className="paper-divider flex items-center justify-between border-t-2 px-6 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-28 rounded" />
            </div>
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
          <Card className="paper-sheet p-6 sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                {generating ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-7 w-7 text-primary" />
                )}
              </div>
              <h2 className="exam-heading mt-4 text-xl font-semibold sm:text-2xl">
                {generating ? "১০টি প্রশ্ন তৈরি হচ্ছে…" : "অনুশীলনের জন্য প্রস্তুত"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {generating
                  ? "একটু অপেক্ষা করুন — কয়েক সেকেন্ডের মধ্যেই প্রশ্ন চলে আসবে।"
                  : "AI দিয়ে তাৎক্ষণিক MCQ তৈরি করুন।"}
              </p>

              {!generating ? (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    onClick={() =>
                      generateAiQuestions({ count: 10, difficulty: "medium", question_style: "mcq", language: "bn" })
                    }
                  >
                    <Sparkles className="mr-1 h-4 w-4" /> ১০টি MCQ শুরু করুন
                  </Button>
                  <button
                    type="button"
                    onClick={() => setGenOpen(true)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    কাস্টম সেটিংস
                  </button>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="mx-auto mt-4 max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </Card>

        ) : (
          <>
            {/* Exam-paper sheet */}
            <Card className="paper-sheet overflow-hidden">
              {/* Paper header — exam style */}
              <div className="paper-divider border-b-2 px-6 pt-6 pb-4">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    এআই প্রেপ পার্টনার · এইচএসসি অনুশীলন
                  </p>
                  <h1 className="exam-heading mt-1 text-2xl font-bold sm:text-3xl">
                    {subject?.name ?? "এইচএসসি বিষয়"}
                  </h1>
                  {subject?.name_bn ? (
                    <p className="text-sm text-muted-foreground">{subject.name_bn}</p>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Field label="অধ্যায়" value={chapter?.name ?? "—"} />
                  <Field
                    label="মোড"
                    value={`${modeMeta.label}`}
                  />
                  <Field
                    label="নম্বর"
                    value={`${toBnDigits(totalMarks)} / ${totalMarks}`}
                  />
                  <Field
                    label="সময়"
                    value={formatDuration(elapsed)}
                    icon={<Timer className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Progress strip */}
              <div className="border-b bg-muted/30 px-6 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    প্রশ্ন {toBnDigits(currentIndex + 1)} / {toBnDigits(questions.length)}
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
                      এই যাচাইকৃত প্রশ্নের জন্য এখনো উত্তরের অপশন যুক্ত হয়নি।
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
                          {result.isCorrect ? "সঠিক উত্তর" : "ভুল উত্তর"}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          আপনি পেয়েছেন {toBnDigits(result.score)} / {toBnDigits(result.maxScore)} নম্বর।
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer actions */}
              <div className="paper-divider flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
                <div className="text-xs text-muted-foreground">
                  জমা দেওয়ার পরেই উত্তর সংরক্ষণ হবে। সঠিক উত্তর জমার আগে দেখানো হবে না।
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
                        <><Loader2 className="h-4 w-4 animate-spin" /> জমা হচ্ছে</>
                      ) : (
                        "উত্তর জমা দিন"
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline">
                        <a href={`/result/${result.attemptId}`}>ফলাফল দেখুন</a>
                      </Button>
                      {currentIndex < questions.length - 1 ? (
                        <Button onClick={goToNextQuestion}>
                          পরবর্তী প্রশ্ন <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Single side helper — keep it minimal */}
            <div className="mt-4 flex justify-center">
              <Button asChild size="sm" variant="ghost">
                <a href={`/chapters?subjectId=${chapter?.subject_id ?? ""}`}>
                  অধ্যায় পরিবর্তন
                </a>
              </Button>
            </div>

          </>
        )}

        <Dialog open={genOpen} onOpenChange={(open) => !generating && setGenOpen(open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="exam-heading">AI দিয়ে Practice Set তৈরি করুন</DialogTitle>
              <DialogDescription>
                আপনার পছন্দ অনুযায়ী প্রশ্ন তৈরি হবে। প্রশ্নগুলি “AI Generated – Review Needed” হিসেবে চিহ্নিত থাকবে।
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">প্রশ্ন সংখ্যা</Label>
                <RadioGroup
                  value={String(genCount)}
                  onValueChange={(v) => setGenCount(Number(v) as 5 | 10 | 20)}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {[5, 10, 20].map((n) => (
                    <Label
                      key={n}
                      htmlFor={`count-${n}`}
                      className={cn(
                        "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                        genCount === n ? "border-foreground bg-muted" : "border-input hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem id={`count-${n}`} value={String(n)} className="sr-only" />
                      {toBnDigits(n)}টি
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">কঠিনতা</Label>
                <RadioGroup
                  value={genDifficulty}
                  onValueChange={(v) => setGenDifficulty(v as "easy" | "medium" | "hard")}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {[
                    { v: "easy", l: "সহজ" },
                    { v: "medium", l: "মাঝারি" },
                    { v: "hard", l: "কঠিন" },
                  ].map((o) => (
                    <Label
                      key={o.v}
                      htmlFor={`diff-${o.v}`}
                      className={cn(
                        "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                        genDifficulty === o.v ? "border-foreground bg-muted" : "border-input hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem id={`diff-${o.v}`} value={o.v} className="sr-only" />
                      {o.l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">প্রশ্নের ধরন</Label>
                <RadioGroup
                  value={genStyle}
                  onValueChange={(v) => setGenStyle(v as "mcq" | "short" | "board")}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {[
                    { v: "mcq", l: "MCQ" },
                    { v: "short", l: "Short Q" },
                    { v: "board", l: "Board Style" },
                  ].map((o) => (
                    <Label
                      key={o.v}
                      htmlFor={`style-${o.v}`}
                      className={cn(
                        "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                        genStyle === o.v ? "border-foreground bg-muted" : "border-input hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem id={`style-${o.v}`} value={o.v} className="sr-only" />
                      {o.l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">ভাষা</Label>
                <RadioGroup
                  value={genLanguage}
                  onValueChange={(v) => setGenLanguage(v as "bn" | "en" | "mixed")}
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {[
                    { v: "bn", l: "বাংলা" },
                    { v: "en", l: "English" },
                    { v: "mixed", l: "Mixed" },
                  ].map((o) => (
                    <Label
                      key={o.v}
                      htmlFor={`lang-${o.v}`}
                      className={cn(
                        "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                        genLanguage === o.v ? "border-foreground bg-muted" : "border-input hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem id={`lang-${o.v}`} value={o.v} className="sr-only" />
                      {o.l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)} disabled={generating}>
                বাতিল
              </Button>
              <Button onClick={() => generateAiQuestions()} disabled={generating}>
                {generating ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> তৈরি হচ্ছে…</>
                ) : (
                  <><Sparkles className="mr-1 h-4 w-4" /> Generate Practice Set</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
