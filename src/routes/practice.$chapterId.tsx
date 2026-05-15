import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { toast } from "sonner";

export const Route = createFileRoute("/practice/$chapterId")({ component: PracticePage });

function PracticePage() {
  const { chapterId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [chapter, setChapter] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ch } = await supabase.from("chapters").select("*, subjects(*)").eq("id", chapterId).maybeSingle();
      setChapter(ch);
      const { data: qs } = await supabase
        .from("questions").select("*").eq("chapter_id", chapterId).eq("is_approved", true)
        .order("created_at", { ascending: false }).limit(10);
      if (!qs || qs.length === 0) {
        toast.error("No questions yet. Generate some first!");
        nav({ to: "/generate" });
        return;
      }
      setQuestions(qs);
      const { data: att } = await supabase.from("test_attempts").insert({
        user_id: user.id,
        subject_id: ch?.subject_id,
        chapter_id: chapterId,
        total_questions: qs.length,
      }).select().single();
      setAttemptId(att?.id ?? null);
    })();
  }, [user, chapterId, nav]);

  const current = questions[idx];

  const submit = async () => {
    if (!attemptId || !user) return;
    setSubmitting(true);
    let correct = 0;
    const rows = questions.map((q) => {
      const ua = (answers[q.id] ?? "").trim();
      const isCorrect = ua.toLowerCase() === String(q.correct_answer).toLowerCase();
      if (isCorrect) correct++;
      return { attempt_id: attemptId, user_id: user.id, question_id: q.id, user_answer: ua, is_correct: isCorrect };
    });
    await supabase.from("user_answers").insert(rows);
    await supabase.from("test_attempts").update({
      correct_count: correct,
      score: Math.round((correct / questions.length) * 100),
      completed_at: new Date().toISOString(),
    }).eq("id", attemptId);

    // update performance summary
    const { data: existing } = await supabase
      .from("performance_summary").select("*").eq("user_id", user.id).eq("chapter_id", chapterId).maybeSingle();
    if (existing) {
      await supabase.from("performance_summary").update({
        total_attempted: existing.total_attempted + questions.length,
        total_correct: existing.total_correct + correct,
        last_attempt_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("performance_summary").insert({
        user_id: user.id, subject_id: chapter?.subject_id, chapter_id: chapterId,
        total_attempted: questions.length, total_correct: correct,
        last_attempt_at: new Date().toISOString(),
      });
    }
    nav({ to: "/result/$attemptId", params: { attemptId } });
  };

  if (!current) return <AppShell><div className="container mx-auto p-10 text-center">Loading...</div></AppShell>;

  const progress = ((idx + 1) / questions.length) * 100;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>{chapter?.subjects?.name} · {chapter?.name}</span>
            <span>Question {idx + 1} of {questions.length}</span>
          </div>
          <Progress value={progress} />
        </div>

        <Card className="p-6 shadow-soft">
          <div className="text-xs text-muted-foreground uppercase mb-2">{current.difficulty} · {current.question_type}</div>
          <h2 className="text-lg font-semibold mb-4">{current.question_text}</h2>

          {current.question_type === "mcq" && Array.isArray(current.options) && (
            <div className="space-y-2">
              {(current.options as string[]).map((o) => {
                const selected = answers[current.id] === o;
                return (
                  <button
                    key={o}
                    onClick={() => setAnswers({ ...answers, [current.id]: o })}
                    className={`w-full text-left p-3 rounded-xl border transition ${selected ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                  >{o}</button>
                );
              })}
            </div>
          )}
          {current.question_type !== "mcq" && (
            <Input
              value={answers[current.id] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [current.id]: e.target.value })}
              placeholder="Type your answer..."
            />
          )}

          <div className="flex justify-between mt-6">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</Button>
            {idx < questions.length - 1 ? (
              <Button onClick={() => setIdx(idx + 1)}>Next →</Button>
            ) : (
              <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Test"}</Button>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
