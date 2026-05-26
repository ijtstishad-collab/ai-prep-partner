import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Bookmark, SkipForward,
} from "lucide-react";
import {
  listBoardQuestions, generateAISimilarQuestion,
} from "@/lib/board-questions.functions";
import { addToRevision } from "@/lib/revision.functions";
import { toast } from "sonner";
import { toBnDigits } from "@/lib/bn";

export const Route = createFileRoute("/chapters/$chapterId/board-practice")({
  validateSearch: (s: Record<string, unknown>) => ({
    questionId: typeof s.questionId === "string" ? s.questionId : undefined,
    patternId: typeof s.patternId === "string" ? s.patternId : undefined,
  }),
  component: BoardPracticePage,
});

const priorityLabel = (s: number) =>
  s >= 70 ? { bn: "অত্যন্ত গুরুত্বপূর্ণ", cls: "bg-red-100 text-red-700 border-red-200" }
  : s >= 40 ? { bn: "গুরুত্বপূর্ণ", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  : { bn: "পরে অনুশীলন", cls: "bg-muted text-muted-foreground" };

type Outcome = "correct" | "wrong" | "skipped";

function BoardPracticePage() {
  const { chapterId } = Route.useParams();
  const { questionId } = Route.useSearch();
  const nav = useNavigate();
  const list = useServerFn(listBoardQuestions);
  const genAI = useServerFn(generateAISimilarQuestion);
  const addRev = useServerFn(addToRevision);

  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [done, setDone] = useState(false);
  const [revisionAdds, setRevisionAdds] = useState(0);
  const [startedAt] = useState(() => Date.now());

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

  const recordOutcome = (qid: string, o: Outcome) => {
    setOutcomes((prev) => (prev[qid] ? prev : { ...prev, [qid]: o }));
  };

  const autoRevise = async (qid: string, reason: "wrong_answer" | "skipped") => {
    try {
      const res = await addRev({
        data: {
          question_id: qid,
          chapter_id: chapterId,
          subject_id: current?.subject_id,
          reason,
        },
      });
      if (!res.duplicate) setRevisionAdds((n) => n + 1);
    } catch { /* silent */ }
  };

  const next = () => {
    setUserAnswer(null);
    setRevealed(false);
    if (idx + 1 >= questions.length) setDone(true);
    else setIdx((i) => i + 1);
  };

  const prev = () => {
    setUserAnswer(null);
    setRevealed(false);
    setIdx((i) => Math.max(0, i - 1));
  };

  const submit = (ans: string) => {
    if (!current) return;
    setUserAnswer(ans);
    setRevealed(true);
    const correct = (current.answer ?? current.correct_answer ?? "").toString().trim().toLowerCase();
    const ok = ans.trim().toLowerCase() === correct;
    recordOutcome(current.id, ok ? "correct" : "wrong");
    if (!ok) void autoRevise(current.id, "wrong_answer");
  };

  const skip = () => {
    if (!current) return;
    recordOutcome(current.id, "skipped");
    void autoRevise(current.id, "skipped");
    next();
  };

  const manualRevise = async () => {
    if (!current) return;
    try {
      const res = await addRev({
        data: {
          question_id: current.id,
          chapter_id: chapterId,
          subject_id: current.subject_id,
          reason: "manual",
        },
      });
      if (res.duplicate) toast.info("এটি আগে থেকেই revision list-এ আছে।");
      else { toast.success("Revision list-এ যোগ করা হয়েছে।"); setRevisionAdds((n) => n + 1); }
    } catch (e: any) {
      toast.error(e.message ?? "ব্যর্থ");
    }
  };

  const trySimilar = async () => {
    if (!current) return;
    try {
      toast.loading("AI দিয়ে অনুরূপ প্রশ্ন তৈরি হচ্ছে...", { id: "sim" });
      await genAI({ data: { chapter_id: chapterId, source_question_id: current.id, count: 1 } });
      toast.success("AI Similar প্রশ্ন তৈরি হয়েছে — Board Questions tab-এ দেখুন", { id: "sim" });
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
          <Button asChild><Link to="/chapters/$chapterId" params={{ chapterId }}>ফিরে যান</Link></Button>
        </div>
      </AppShell>
    );
  }

  // ===== RESULT SUMMARY =====
  if (done) {
    const correctCount = Object.values(outcomes).filter((v) => v === "correct").length;
    const wrongCount = Object.values(outcomes).filter((v) => v === "wrong").length;
    const skippedCount = Object.values(outcomes).filter((v) => v === "skipped").length;
    const attempted = correctCount + wrongCount;
    const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");

    return (
      <AppShell>
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <Card className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Practice Result</p>
            <h1 className="exam-heading mt-1 text-2xl font-bold">সেশন সম্পন্ন</h1>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <Stat label="Score" value={`${toBnDigits(correctCount)}/${toBnDigits(questions.length)}`} />
              <Stat label="শুদ্ধতা" value={`${toBnDigits(accuracy)}%`} />
              <Stat label="সময়" value={`${mm}:${ss}`} />
              <Stat label="শুদ্ধ" value={toBnDigits(correctCount)} />
              <Stat label="ভুল" value={toBnDigits(wrongCount)} />
              <Stat label="Skip" value={toBnDigits(skippedCount)} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Revision list-এ যোগ হয়েছে: {toBnDigits(revisionAdds)}টি প্রশ্ন
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link to="/chapters/$chapterId" params={{ chapterId }}>Chapter page-এ ফিরুন</Link></Button>
              <Button variant="outline" onClick={() => { setIdx(0); setDone(false); setOutcomes({}); }}>
                আবার practice
              </Button>
              <Button variant="outline" asChild><Link to="/mock-test">Mock test দিন</Link></Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const isMcq = current.question_type === "mcq" && Array.isArray(current.options) && current.options.length > 0;
  const correct = (current.answer ?? current.correct_answer ?? "").toString().trim();
  const isCorrect = revealed && userAnswer && userAnswer.trim().toLowerCase() === correct.toLowerCase();
  const isAI = current.source_type === "ai_generated";
  const sourceLabel = isAI ? "AI Similar — Based on Board Pattern"
    : current.source_type === "teacher_verified" ? "Teacher Verified" : "Official Board";
  const p = priorityLabel(current.priority_score ?? 0);

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/chapters/$chapterId" params={{ chapterId }} className="hover:text-foreground">
            ← Chapter-এ ফিরে যান
          </Link>
          <span>প্রশ্ন {toBnDigits(idx + 1)} / {toBnDigits(questions.length)}</span>
        </div>

        <Card className="p-5">
          {/* Badges row */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {current.year && <Badge variant="outline">{toBnDigits(current.year)}</Badge>}
            {current.board && <Badge variant="secondary">{current.board} Board</Badge>}
            <Badge variant="outline" className="uppercase">{current.question_type}</Badge>
            <Badge variant={isAI ? "outline" : "secondary"}
              className={isAI ? "border-purple-300 bg-purple-50 text-purple-700" : ""}>
              {sourceLabel}
            </Badge>
            <Badge className={p.cls}>{p.bn}</Badge>
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
            <div>
              {!revealed ? (
                <Button onClick={() => { setRevealed(true); recordOutcome(current.id, "correct"); }} variant="outline">
                  উত্তর দেখুন
                </Button>
              ) : null}
            </div>
          )}

          {/* Pre-answer actions */}
          {!revealed && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={skip}>
                <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
              </Button>
              <Button size="sm" variant="ghost" onClick={manualRevise}>
                <Bookmark className="mr-1 h-3.5 w-3.5" /> Add to Revision
              </Button>
            </div>
          )}

          {/* ANSWER PANEL */}
          {revealed && (
            <div className="mt-5 space-y-3 rounded-md border bg-muted/30 p-4">
              {isMcq && (
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {isCorrect ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-600" /> সঠিক উত্তর</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-red-600" /> ভুল উত্তর</>
                  )}
                </div>
              )}
              <Section title="সঠিক উত্তর">{correct || "—"}</Section>
              {current.explanation_bn && <Section title="ব্যাখ্যা (বাংলা)">{current.explanation_bn}</Section>}
              {current.common_mistake && <Section title="সাধারণ ভুল">{current.common_mistake}</Section>}
              {current.formula && <Section title="সূত্র / নিয়ম">{current.formula}</Section>}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={trySimilar}>
                  <Sparkles className="mr-1 h-3 w-3" /> Try Similar (AI)
                </Button>
                <Button size="sm" variant="outline" onClick={manualRevise}>
                  <Bookmark className="mr-1 h-3 w-3" /> Add to Revision
                </Button>
                <Button size="sm" onClick={next}>
                  পরবর্তী প্রশ্ন <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={prev} disabled={idx === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> পূর্ববর্তী
          </Button>
          <Button variant="ghost" onClick={() => setDone(true)}>সেশন শেষ</Button>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{title}</p>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-3">
      <div className="exam-heading text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
