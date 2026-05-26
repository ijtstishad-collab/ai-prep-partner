import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import {
  listBoardQuestions,
  generateAISimilarQuestion,
} from "@/lib/board-questions.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/chapters/$chapterId/board-practice")({
  validateSearch: (s: Record<string, unknown>) => ({
    questionId: typeof s.questionId === "string" ? s.questionId : undefined,
    patternId: typeof s.patternId === "string" ? s.patternId : undefined,
  }),
  component: BoardPracticePage,
});

function BoardPracticePage() {
  const { chapterId } = Route.useParams();
  const { questionId } = Route.useSearch();
  const nav = useNavigate();
  const list = useServerFn(listBoardQuestions);
  const genAI = useServerFn(generateAISimilarQuestion);

  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const q = useQuery({
    queryKey: ["bp", chapterId],
    queryFn: () => list({ data: { chapter_id: chapterId } }),
  });

  const all: any[] = q.data?.questions ?? [];
  const questions = useMemo(() => {
    if (questionId) {
      const found = all.find((x) => x.id === questionId);
      return found ? [found, ...all.filter((x) => x.id !== questionId)] : all;
    }
    return all;
  }, [all, questionId]);

  const current = questions[idx];

  const next = () => {
    setUserAnswer(null);
    setRevealed(false);
    setIdx((i) => Math.min(i + 1, questions.length - 1));
  };
  const prev = () => {
    setUserAnswer(null);
    setRevealed(false);
    setIdx((i) => Math.max(0, i - 1));
  };

  const submit = (ans: string) => {
    setUserAnswer(ans);
    setRevealed(true);
  };

  const trySimilar = async () => {
    if (!current) return;
    try {
      toast.loading("AI দিয়ে অনুরূপ প্রশ্ন তৈরি হচ্ছে...", { id: "sim" });
      await genAI({ data: { chapter_id: chapterId, source_question_id: current.id, count: 1 } });
      toast.success("AI Similar প্রশ্ন তৈরি হয়েছে — Board Questions পেজে দেখুন", { id: "sim" });
    } catch (e: any) {
      toast.error(e.message ?? "ব্যর্থ", { id: "sim" });
    }
  };

  if (q.isLoading) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div></AppShell>;
  }

  if (!current) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-3xl px-4 py-10 text-center">
          <p className="mb-4 text-muted-foreground">কোনো প্রশ্ন পাওয়া যায়নি।</p>
          <Button asChild><Link to="/chapters/$chapterId/board-questions" params={{ chapterId }}>ফিরে যান</Link></Button>
        </div>
      </AppShell>
    );
  }

  const isMcq = current.question_type === "mcq" && Array.isArray(current.options) && current.options.length > 0;
  const correct = (current.answer ?? current.correct_answer ?? "").toString().trim();
  const isCorrect = revealed && userAnswer && userAnswer.trim().toLowerCase() === correct.toLowerCase();
  const isAI = current.source_type === "ai_generated";

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/chapters/$chapterId/board-questions" params={{ chapterId }} className="hover:text-foreground">
            ← বোর্ড প্রশ্নে ফিরে যান
          </Link>
          <span>{idx + 1} / {questions.length}</span>
        </div>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {current.year && <Badge variant="outline">{current.year}</Badge>}
            {current.board && <Badge variant="secondary">{current.board} Board</Badge>}
            <Badge variant="outline" className="uppercase">{current.question_type}</Badge>
            {isAI && <Badge className="border-purple-300 bg-purple-50 text-purple-700">AI Similar</Badge>}
          </div>

          <p className="exam-heading mb-4 text-base font-medium leading-relaxed">{current.question_text}</p>

          {isMcq ? (
            <div className="space-y-2">
              {(current.options as string[]).map((opt, i) => {
                const isSel = userAnswer === opt;
                const isRight = revealed && opt.trim().toLowerCase() === correct.toLowerCase();
                return (
                  <button
                    key={i}
                    disabled={revealed}
                    onClick={() => submit(opt)}
                    className={`w-full rounded-md border p-3 text-left text-sm transition ${
                      isRight ? "border-green-500 bg-green-50"
                      : isSel ? "border-red-400 bg-red-50"
                      : "hover:border-foreground/40"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)} variant="outline">উত্তর দেখুন</Button>
              ) : null}
            </div>
          )}

          {revealed && (
            <div className="mt-5 space-y-3 rounded-md border bg-muted/30 p-4">
              {isMcq && (
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isCorrect ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-600" /> সঠিক</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-red-600" /> ভুল</>
                  )}
                </div>
              )}
              <div>
                <p className="text-[11px] font-medium uppercase text-muted-foreground">সঠিক উত্তর</p>
                <p className="text-sm">{correct || "—"}</p>
              </div>
              {current.explanation_bn && (
                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">ব্যাখ্যা</p>
                  <p className="text-sm leading-relaxed">{current.explanation_bn}</p>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={trySimilar}>
                <Sparkles className="mr-1 h-3 w-3" /> Try Similar Question (AI)
              </Button>
            </div>
          )}
        </Card>

        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={prev} disabled={idx === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> পূর্ববর্তী
          </Button>
          <Button onClick={next} disabled={idx === questions.length - 1}>
            পরবর্তী <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
