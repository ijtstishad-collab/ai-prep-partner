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
import { generateQuestions } from "@/lib/ai.functions";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/generate")({ component: GeneratePage });

function GeneratePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const generate = useServerFn(generateQuestions);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [type, setType] = useState<"mcq" | "short" | "written">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);
  useEffect(() => {
    supabase.from("subjects").select("*").eq("is_active", true).then(({ data }) => setSubjects(data ?? []));
  }, []);
  useEffect(() => {
    if (!subjectId) return setChapters([]);
    supabase.from("chapters").select("*").eq("subject_id", subjectId).eq("is_active", true).order("order_index")
      .then(({ data }) => setChapters(data ?? []));
  }, [subjectId]);

  const onGenerate = async () => {
    if (!chapterId) return toast.error("Select a chapter first");
    setBusy(true);
    setQuestions([]);
    try {
      const res = await generate({ data: { chapter_id: chapterId, question_type: type, difficulty, count } });
      setQuestions(res.questions);
      toast.success(`Generated ${res.questions.length} questions`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate");
    } finally {
      setBusy(false);
    }
  };

  const startPractice = () => {
    if (chapterId) nav({ to: "/practice/$chapterId", params: { chapterId } });
  };

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
              <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="short">Short Question</SelectItem>
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
            <Label>Number of Questions</Label>
            <Input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={onGenerate} disabled={busy || !chapterId} className="flex-1">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <>Generate ✨</>}
            </Button>
            {questions.length > 0 && <Button variant="outline" onClick={startPractice}>Practice Now</Button>}
          </div>
        </Card>

        {questions.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Preview</h2>
            {questions.map((q, i) => (
              <Card key={q.id} className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Q{i + 1} · {q.difficulty} · {q.question_type}</div>
                <p className="font-medium">{q.question_text}</p>
                {q.options && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {(q.options as string[]).map((o) => (
                      <li key={o} className={`px-3 py-2 rounded-lg border ${o === q.correct_answer ? "bg-success/10 border-success" : ""}`}>{o}</li>
                    ))}
                  </ul>
                )}
                {!q.options && <p className="mt-2 text-sm"><strong>Answer:</strong> {q.correct_answer}</p>}
                <p className="mt-2 text-xs text-muted-foreground">ব্যাখ্যা: {q.explanation_bn}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
