import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateAiQuestions, type GeneratedItem } from "@/lib/ai-generator.functions";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-generator")({ component: AiGeneratorPage });

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

function AiGeneratorPage() {
  const generate = useServerFn(generateAiQuestions);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [type, setType] = useState<"mcq" | "short" | "creative" | "board" | "admission">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GeneratedItem[]>([]);

  useEffect(() => {
    supabase
      .from("subjects")
      .select("id, name")
      .eq("is_active", true)
      .then(({ data }) => setSubjects((data ?? []) as Subject[]));
  }, []);

  useEffect(() => {
    if (!subjectId) return setChapters([]);
    supabase
      .from("chapters")
      .select("id, name, subject_id")
      .eq("is_active", true)
      .eq("subject_id", subjectId)
      .order("order_index")
      .then(({ data }) => setChapters((data ?? []) as Chapter[]));
  }, [subjectId]);

  const run = async (save: boolean) => {
    if (!chapterId) return toast.error("Choose a chapter");
    setLoading(true);
    try {
      const res = await generate({
        data: { chapter_id: chapterId, question_type: type, difficulty, count, save },
      });
      setItems(res.items);
      toast.success(
        save ? `Generated ${res.items.length} · saved ${res.savedCount}` : `Generated ${res.items.length}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Question Generator</h1>
          <p className="mt-1 text-muted-foreground">
            Generate original HSC questions by subject, chapter, type, and difficulty.
          </p>
        </div>

        <Card className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chapter</Label>
            <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
              <SelectTrigger>
                <SelectValue placeholder={subjectId ? "Select chapter" : "Pick subject first"} />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="short">Short Question</SelectItem>
                <SelectItem value="creative">Creative (CQ)</SelectItem>
                <SelectItem value="board">Board-style</SelectItem>
                <SelectItem value="admission">Admission-style</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Count (1–5)</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => run(false)} disabled={loading || !chapterId} className="flex-1">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate
            </Button>
            <Button onClick={() => run(true)} disabled={loading || !chapterId} variant="secondary" className="flex-1">
              Save to Bank
            </Button>
          </div>
        </Card>

        {items.length > 0 && (
          <div className="mt-6 space-y-3">
            {items.map((q, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium whitespace-pre-wrap">{i + 1}. {q.question_text}</p>
                  <Badge variant="outline">{type}</Badge>
                </div>
                {q.options && (
                  <ol className="mt-3 space-y-1 text-sm">
                    {q.options.map((o, oi) => {
                      const key = String.fromCharCode(65 + oi);
                      const isCorrect = o === q.correct_answer;
                      return (
                        <li
                          key={oi}
                          className={`rounded border p-2 ${isCorrect ? "border-primary bg-primary/5" : ""}`}
                        >
                          <span className="font-semibold mr-2">{key}.</span>{o}
                          {isCorrect && <Badge className="ml-2">Answer</Badge>}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {q.answer_text && (
                  <div className="mt-3 rounded border bg-muted/40 p-3 text-sm">
                    <p className="font-semibold mb-1">Answer</p>
                    <p className="whitespace-pre-wrap">{q.answer_text}</p>
                  </div>
                )}
                {q.explanation_bn && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">ব্যাখ্যা:</span> {q.explanation_bn}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
