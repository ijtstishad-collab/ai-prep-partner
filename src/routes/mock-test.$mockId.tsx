import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getMockTest, saveMockAnswer, submitMockTest } from "@/lib/mock-test.functions";
import { addToRevision } from "@/lib/revision.functions";
import { toast } from "sonner";
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Flag, Timer, XCircle } from "lucide-react";
import { z } from "zod";

const search = z.object({ view: z.enum(["test", "result", "review"]).optional() });

export const Route = createFileRoute("/mock-test/$mockId")({
  validateSearch: search,
  component: MockRunner,
});

type Q = {
  mq_id: string;
  order: number;
  selected_answer: string | null;
  is_marked_for_review: boolean;
  is_correct: boolean | null;
  question: any;
};

function MockRunner() {
  const { mockId } = Route.useParams();
  const { view } = Route.useSearch();
  const fetchMock = useServerFn(getMockTest);
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mock-test", mockId],
    queryFn: () => fetchMock({ data: { mock_id: mockId } }),
  });

  if (isLoading) return <AppShell><div className="container mx-auto px-4 py-10 text-muted-foreground">লোড হচ্ছে…</div></AppShell>;
  if (!data) return <AppShell><div className="container mx-auto px-4 py-10">পাওয়া যায়নি।</div></AppShell>;

  const status = data.mock.status;
  if (status === "in_progress") return <TestScreen mockId={mockId} data={data} onChange={() => { qc.invalidateQueries({ queryKey: ["mock-test", mockId] }); refetch(); }} />;
  if (view === "review") return <ReviewScreen mockId={mockId} data={data} />;
  return <ResultScreen mockId={mockId} data={data} />;
}

/* ---------------- TEST ---------------- */

function TestScreen({ mockId, data, onChange }: { mockId: string; data: any; onChange: () => void }) {
  const mock = data.mock;
  const navigate = useNavigate();
  const save = useServerFn(saveMockAnswer);
  const submit = useServerFn(submitMockTest);
  const [idx, setIdx] = useState(0);
  const [questions, setQuestions] = useState<Q[]>(data.questions);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync local with refetched data
  useEffect(() => { setQuestions(data.questions); }, [data.questions]);

  // Timer
  const endsAt = useMemo(() => {
    if (!mock.timer_minutes) return null;
    return new Date(mock.started_at).getTime() + mock.timer_minutes * 60_000;
  }, [mock]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  const remaining = endsAt ? Math.max(0, endsAt - now) : null;

  useEffect(() => {
    if (remaining === 0) {
      doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0]);

  const current = questions[idx];

  async function setAnswer(val: string | null) {
    if (!current) return;
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, selected_answer: val } : q));
    try {
      await save({ data: { mq_id: current.mq_id, selected_answer: val } });
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleMark() {
    if (!current) return;
    const next = !current.is_marked_for_review;
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, is_marked_for_review: next } : q));
    try { await save({ data: { mq_id: current.mq_id, selected_answer: current.selected_answer, is_marked_for_review: next } }); }
    catch (e: any) { toast.error(e.message); }
  }

  async function doSubmit(expired = false) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submit({ data: { mock_id: mockId, expired } });
      toast.success(expired ? "সময় শেষ — স্বয়ংক্রিয়ভাবে submit হয়েছে।" : "Mock test submit হয়েছে।");
      navigate({ to: "/mock-test/$mockId", params: { mockId }, search: { view: "result" } });
      onChange();
    } catch (e: any) { toast.error(e.message); setSubmitting(false); }
  }

  const answered = questions.filter((q) => q.selected_answer).length;
  const marked = questions.filter((q) => q.is_marked_for_review).length;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Top bar */}
        <Card className="p-4 mb-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-xs text-muted-foreground capitalize">{mock.mock_type.replace("_", " ")} Mock</p>
            <h1 className="text-lg font-semibold">প্রশ্ন {idx + 1} / {questions.length}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {remaining !== null && (
              <span className={`inline-flex items-center gap-1 font-mono font-semibold ${remaining < 60_000 ? "text-destructive" : ""}`}>
                <Timer className="h-4 w-4" />{fmtTime(remaining)}
              </span>
            )}
            <span className="text-muted-foreground">উত্তর: {answered} · Marked: {marked}</span>
            <Button onClick={() => setConfirmSubmit(true)} disabled={submitting}>Submit Test</Button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Question */}
          <Card className="p-6">
            {current ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {current.question?.year && <Badge variant="outline">{current.question.year}</Badge>}
                  {current.question?.board && <Badge variant="outline">{current.question.board}</Badge>}
                  {current.question?._ai ? <Badge variant="secondary">AI Similar</Badge> : <Badge variant="secondary">Verified Board</Badge>}
                  {current.question?.priority_score >= 70 && <Badge>Very Important</Badge>}
                </div>
                <p className="text-base mb-5 whitespace-pre-wrap">{current.question?.question_text}</p>

                <RadioGroup
                  value={current.selected_answer ?? ""}
                  onValueChange={(v) => setAnswer(v)}
                  className="space-y-2"
                >
                  {renderOptions(current.question?.options).map(({ key, text }) => (
                    <label key={key} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40 cursor-pointer">
                      <RadioGroupItem value={key} id={`opt-${key}`} className="mt-0.5" />
                      <span className="text-sm"><span className="font-medium mr-1">{key.toUpperCase()}.</span>{text}</span>
                    </label>
                  ))}
                </RadioGroup>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
                    <ChevronLeft className="h-4 w-4" />Previous
                  </Button>
                  <Button size="sm" onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
                    Save & Next<ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleMark}>
                    <Flag className="h-4 w-4" />{current.is_marked_for_review ? "Unmark" : "Mark for Review"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAnswer(null)} disabled={!current.selected_answer}>
                    Clear Answer
                  </Button>
                </div>
              </>
            ) : <p className="text-muted-foreground">কোনো প্রশ্ন পাওয়া যায়নি।</p>}
          </Card>

          {/* Navigator */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Question Navigator</h3>
            <div className="grid grid-cols-6 gap-2">
              {questions.map((q, i) => {
                const state = q.is_marked_for_review ? "marked" : q.selected_answer ? "answered" : "blank";
                const cls = state === "answered" ? "bg-primary text-primary-foreground" :
                  state === "marked" ? "bg-amber-100 border-amber-300 text-amber-900" :
                  "bg-muted text-muted-foreground";
                return (
                  <button
                    key={q.mq_id}
                    onClick={() => setIdx(i)}
                    className={`h-9 w-9 rounded-md text-sm font-medium border ${cls} ${i === idx ? "ring-2 ring-primary" : ""}`}
                  >{i + 1}</button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div><span className="inline-block h-3 w-3 rounded bg-primary mr-2" />Answered</div>
              <div><span className="inline-block h-3 w-3 rounded bg-amber-200 mr-2" />Marked for Review</div>
              <div><span className="inline-block h-3 w-3 rounded bg-muted border mr-2" />Unanswered</div>
            </div>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি নিশ্চিতভাবে test submit করতে চান?</AlertDialogTitle>
            <AlertDialogDescription>
              Submit করার পর আপনার score ও explanation দেখা যাবে। অনুত্তরিত প্রশ্ন revision-এ যোগ হবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSubmit(false)}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

/* ---------------- RESULT ---------------- */

function ResultScreen({ mockId, data }: { mockId: string; data: any }) {
  const mock = data.mock;
  const qs: Q[] = data.questions;
  const total = qs.length || 1;
  const avgTime = mock.time_taken / total;

  // Breakdown by board
  const byBoard = new Map<string, { c: number; t: number }>();
  const byDifficulty = new Map<string, { c: number; t: number }>();
  for (const q of qs) {
    const b = q.question?.board ?? "—";
    const d = q.question?.difficulty ?? "—";
    const bb = byBoard.get(b) ?? { c: 0, t: 0 };
    bb.t += 1; if (q.is_correct) bb.c += 1; byBoard.set(b, bb);
    const dd = byDifficulty.get(d) ?? { c: 0, t: 0 };
    dd.t += 1; if (q.is_correct) dd.c += 1; byDifficulty.set(d, dd);
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="mb-6">
          <p className="text-sm text-primary capitalize">{mock.mock_type.replace("_", " ")} Mock</p>
          <h1 className="text-3xl font-bold">ফলাফল</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submitted {new Date(mock.submitted_at).toLocaleString("bn-BD")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Stat label="Score" value={`${mock.correct_count}/${mock.question_count}`} />
          <Stat label="Accuracy" value={`${Math.round(mock.accuracy)}%`} />
          <Stat label="Time Taken" value={fmtSec(mock.time_taken)} />
          <Stat label="Avg / Question" value={fmtSec(Math.round(avgTime))} />
          <Stat label="Correct" value={String(mock.correct_count)} />
          <Stat label="Wrong" value={String(mock.wrong_count)} />
          <Stat label="Unanswered" value={String(mock.skipped_count)} />
          <Stat label="Revision Added" value={String(mock.wrong_count + mock.skipped_count)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Breakdown title="বোর্ড অনুযায়ী" rows={[...byBoard.entries()].map(([k, v]) => [k, v])} />
          <Breakdown title="কঠিনতা অনুযায়ী" rows={[...byDifficulty.entries()].map(([k, v]) => [k, v])} />
        </div>

        <Card className="p-5 mb-6">
          <h3 className="font-semibold mb-3">পরবর্তী পদক্ষেপ</h3>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
            <li>ভুল উত্তরগুলো revise করুন</li>
            <li>একই বিষয়ের আরেকটি chapter mock দিন</li>
            <li>Weak topics study plan-এ যোগ করুন</li>
          </ul>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/mock-test/$mockId" params={{ mockId }} search={{ view: "review" }}>Review Answers</Link>
          </Button>
          <Button variant="outline" asChild><Link to="/practice">Practice Similar Questions</Link></Button>
          <Button variant="outline" asChild><Link to="/dashboard">Back to Dashboard</Link></Button>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- REVIEW ---------------- */

function ReviewScreen({ mockId, data }: { mockId: string; data: any }) {
  const qs: Q[] = data.questions;
  const addRev = useServerFn(addToRevision);

  async function manualRevision(q: Q) {
    try {
      await addRev({ data: {
        question_id: q.question.id,
        subject_id: q.question.subject_id ?? undefined,
        chapter_id: q.question.chapter_id ?? undefined,
        reason: "manual",
        source_table: q.question._ai ? "generated_questions" : "past_questions",
      }});
      toast.success("Revision-এ যোগ হয়েছে");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Answer Review</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/mock-test/$mockId" params={{ mockId }} search={{ view: "result" }}>← Result</Link>
          </Button>
        </div>

        <div className="space-y-4">
          {qs.map((q, i) => {
            const correct = (q.question?.answer ?? "").toString().toLowerCase();
            const got = (q.selected_answer ?? "").toString().toLowerCase();
            const status = !q.selected_answer ? "skipped" : got === correct ? "correct" : "wrong";
            return (
              <Card key={q.mq_id} className="p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline">#{i + 1}</Badge>
                  {q.question?.year && <Badge variant="outline">{q.question.year}</Badge>}
                  {q.question?.board && <Badge variant="outline">{q.question.board}</Badge>}
                  {q.question?._ai ? <Badge variant="secondary">AI Similar</Badge> : <Badge variant="secondary">Verified Board</Badge>}
                  {status === "correct" && <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Correct</Badge>}
                  {status === "wrong" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Wrong</Badge>}
                  {status === "skipped" && <Badge variant="secondary">Skipped</Badge>}
                </div>
                <p className="text-sm font-medium mb-3 whitespace-pre-wrap">{q.question?.question_text}</p>

                <div className="space-y-1.5 mb-4">
                  {renderOptions(q.question?.options).map(({ key, text }) => {
                    const isCorrect = key.toLowerCase() === correct;
                    const isPicked = key.toLowerCase() === got;
                    const cls = isCorrect ? "border-green-500 bg-green-50" :
                      isPicked ? "border-destructive bg-destructive/5" : "";
                    return (
                      <div key={key} className={`text-sm rounded-md border p-2 ${cls}`}>
                        <span className="font-medium mr-1">{key.toUpperCase()}.</span>{text}
                        {isCorrect && <span className="ml-2 text-xs text-green-700">✓ সঠিক</span>}
                        {isPicked && !isCorrect && <span className="ml-2 text-xs text-destructive">আপনার উত্তর</span>}
                      </div>
                    );
                  })}
                </div>

                {q.question?.explanation_bn && (
                  <Box title="ব্যাখ্যা (Bangla)">{q.question.explanation_bn}</Box>
                )}
                {q.question?.common_mistake && (
                  <Box title="সাধারণ ভুল">{q.question.common_mistake}</Box>
                )}
                {q.question?.formula_or_rule && (
                  <Box title="সূত্র / নিয়ম">{q.question.formula_or_rule}</Box>
                )}
                {(q.question?.why_a_wrong || q.question?.why_b_wrong || q.question?.why_c_wrong || q.question?.why_d_wrong) && (
                  <Box title="কেন অন্য option গুলো ভুল">
                    <ul className="space-y-1">
                      {q.question.why_a_wrong && <li><strong>A:</strong> {q.question.why_a_wrong}</li>}
                      {q.question.why_b_wrong && <li><strong>B:</strong> {q.question.why_b_wrong}</li>}
                      {q.question.why_c_wrong && <li><strong>C:</strong> {q.question.why_c_wrong}</li>}
                      {q.question.why_d_wrong && <li><strong>D:</strong> {q.question.why_d_wrong}</li>}
                    </ul>
                  </Box>
                )}

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => manualRevision(q)}>
                    <Bookmark className="h-3 w-3" />Add to Revision
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- helpers ---------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Card>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, { c: number; t: number }][] }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
        <div className="space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-1.5">
              <span>{k}</span>
              <span className="font-medium">{v.c}/{v.t} ({Math.round((v.c / v.t) * 100)}%)</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 mb-2 text-sm">
      <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function renderOptions(opts: any): { key: string; text: string }[] {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((t: any, i: number) => ({ key: String.fromCharCode(97 + i), text: String(t) }));
  }
  if (typeof opts === "object") {
    return Object.entries(opts).map(([k, v]) => ({ key: k.toLowerCase(), text: String(v) }));
  }
  return [];
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function fmtSec(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}
