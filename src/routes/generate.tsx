import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { generateQuestions, getChapterReadiness, getDemoQuestions, INSUFFICIENT_CONTENT } from "@/lib/ai.functions";
import { toast } from "sonner";
import { Sparkles, Loader2, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReportIssueButton } from "@/components/ReportIssueButton";

export const Route = createFileRoute("/generate")({ component: GeneratePage });

type Readiness = "not_started" | "content_added" | "ai_ready" | "teacher_reviewed";

function ReadinessBadge({ status }: { status: Readiness }) {
  if (status === "teacher_reviewed") {
    return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Teacher Reviewed</Badge>;
  }
  if (status === "ai_ready") {
    return <Badge className="gap-1"><Sparkles className="h-3 w-3" /> AI Ready</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><AlertCircle className="h-3 w-3" /> Needs Content</Badge>;
}

function GeneratePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const generate = useServerFn(generateQuestions);
  const readinessFn = useServerFn(getChapterReadiness);
  const demoFn = useServerFn(getDemoQuestions);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [type, setType] = useState<"mcq" | "short" | "written">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);
  useEffect(() => {
    supabase.from("subjects").select("*").eq("is_active", true).order("name").then(({ data }) => setSubjects(data ?? []));
  }, []);
  useEffect(() => {
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("*").eq("subject_id", subjectId).eq("is_active", true).order("order_index")
      .then(async ({ data }) => {
        const list = data ?? [];
        setChapters(list);
        // fetch readiness for each chapter (parallel)
        const entries = await Promise.all(list.map(async (c) => {
          try { const r = await readinessFn({ data: { chapter_id: c.id } }); return [c.id, r.status as Readiness] as const; }
          catch { return [c.id, "not_started" as Readiness] as const; }
        }));
        setReadiness(Object.fromEntries(entries));
      });
  }, [subjectId, readinessFn]);

  const onGenerate = async () => {
    if (!chapterId) return toast.error("Select a chapter first");
    setBusy(true);
    setQuestions([]);
    setDemoMode(false);
    try {
      const res = await generate({ data: { chapter_id: chapterId, question_type: type, difficulty, count } });
      setQuestions(res.questions);
      toast.success(`Generated ${res.questions.length} questions`);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes(INSUFFICIENT_CONTENT) || msg.toLowerCase().includes("not enough verified")) {
        // Fallback: demo mode
        try {
          const demo = await demoFn({ data: { chapter_id: chapterId } });
          setQuestions(demo.demo);
          setDemoMode(true);
        } catch {
          setDemoMode(true);
        }
      } else {
        toast.error(msg || "Failed to generate");
      }
    } finally {
      setBusy(false);
    }
  };

  const startPractice = () => {
    if (chapterId) nav({ to: "/practice/$chapterId", params: { chapterId } });
  };

  const currentReadiness = chapterId ? readiness[chapterId] : undefined;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" /> AI Question Generator</h1>
        <p className="text-muted-foreground mb-6">Generate fresh chapter-wise questions powered by AI.</p>

        <Card className="p-6 grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chapter</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger><SelectValue placeholder="Choose chapter" /></SelectTrigger>
              <SelectContent>
                {chapters.map((c) => {
                  const st = readiness[c.id];
                  const tag = st === "teacher_reviewed" ? "Teacher Reviewed" : st === "ai_ready" ? "AI Ready" : "Needs Content";
                  return <SelectItem key={c.id} value={c.id}>{c.name} — {tag}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {currentReadiness && (
              <div className="mt-2"><ReadinessBadge status={currentReadiness} /></div>
            )}
          </div>
          <div>
            <Label>Question Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="short">Short question</SelectItem>
                <SelectItem value="written">Written</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Number of questions</Label>
            <Input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={onGenerate} disabled={busy || !chapterId} className="flex-1">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <>Generate ✨</>}
            </Button>
            {questions.length > 0 && <Button variant="outline" onClick={startPractice}>Practice now</Button>}
          </div>
        </Card>

        {demoMode && (
          <Card className="p-4 mb-4 border-warning/40 bg-warning/5">
            <div className="flex items-start gap-2">
              <BookOpen className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium">Verified content for this chapter is being prepared.</p>
                <p className="text-sm text-muted-foreground">Try demo questions for now while our teachers add syllabus, textbook, and past-question material.</p>
              </div>
            </div>
          </Card>
        )}

        {questions.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-semibold">{demoMode ? "Demo questions" : "Preview"}</h2>
            {questions.map((q, i) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-muted-foreground">Q{i + 1} · {q.difficulty} · {q.question_type}</div>
                  {!demoMode && <ReportIssueButton questionId={q.id} />}
                </div>
                {demoMode ? (
                  <Badge variant="outline" className="mb-2 gap-1"><BookOpen className="h-3 w-3" /> Demo question</Badge>
                ) : q.status === "approved" && q.is_teacher_reviewed ? (
                  <Badge className="mb-2 gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                ) : (
                  <Badge variant="secondary" className="mb-2 gap-1">
                    <Sparkles className="h-3 w-3" /> AI Generated — verify with textbook or teacher if needed
                  </Badge>
                )}
                <p className="font-medium">{q.question_text}</p>
                {q.options && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {(q.options as string[]).map((o) => (
                      <li key={o} className={`px-3 py-2 rounded-lg border ${o === q.correct_answer ? "bg-success/10 border-success" : ""}`}>{o}</li>
                    ))}
                  </ul>
                )}
                {!q.options && <p className="mt-2 text-sm"><strong>Answer:</strong> {q.correct_answer}</p>}
                {q.explanation_bn && <p className="mt-2 text-xs text-muted-foreground">ব্যাখ্যা: {q.explanation_bn}</p>}
              </Card>
            ))}
          </div>
        ) : demoMode ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No demo questions seeded for this chapter yet. Please pick another chapter.
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
