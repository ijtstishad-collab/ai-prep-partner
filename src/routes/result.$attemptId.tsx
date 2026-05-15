import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/result/$attemptId")({ component: ResultPage });

function ResultPage() {
  const { attemptId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase
        .from("test_attempts").select("*, subjects(name), chapters(id, name, name_bn)")
        .eq("id", attemptId).maybeSingle();
      setAttempt(a);
      const { data: ans } = await supabase
        .from("user_answers")
        .select("*, questions(question_text, options, correct_answer, explanation_bn, question_type)")
        .eq("attempt_id", attemptId);
      setItems(ans ?? []);
    })();
  }, [attemptId]);

  if (!attempt) return <AppShell><div className="container mx-auto p-10 text-center">Loading...</div></AppShell>;

  const pct = Math.round((attempt.correct_count / Math.max(attempt.total_questions, 1)) * 100);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="p-8 text-center bg-gradient-card shadow-elegant mb-6">
          <p className="text-sm text-muted-foreground">{attempt.subjects?.name} · {attempt.chapters?.name}</p>
          <div className="text-6xl font-bold my-3 bg-gradient-hero bg-clip-text text-transparent">{pct}%</div>
          <p className="text-lg">{attempt.correct_count} / {attempt.total_questions} correct</p>
          <p className="mt-2 text-muted-foreground">{pct >= 80 ? "চমৎকার! 🎉" : pct >= 60 ? "ভালো করেছেন! আরও practice করুন।" : "আরও চর্চা দরকার, হাল ছাড়বেন না!"}</p>
          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            <Button asChild variant="outline"><Link to="/practice/$chapterId" params={{ chapterId: attempt.chapter_id }}>Retry</Link></Button>
            <Button asChild><Link to="/dashboard">Dashboard</Link></Button>
          </div>
        </Card>

        <h2 className="font-semibold mb-3">Review answers</h2>
        <div className="space-y-3">
          {items.map((it, i) => {
            const q = it.questions;
            return (
              <Card key={it.id} className="p-4">
                <div className="flex items-start gap-3">
                  {it.is_correct ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Q{i + 1}</div>
                    <p className="font-medium">{q?.question_text}</p>
                    <p className="mt-2 text-sm"><span className="text-muted-foreground">Your answer:</span> <span className={it.is_correct ? "text-success" : "text-destructive"}>{it.user_answer || "—"}</span></p>
                    {!it.is_correct && <p className="text-sm"><span className="text-muted-foreground">Correct:</span> <span className="text-success">{q?.correct_answer}</span></p>}
                    {q?.explanation_bn && <p className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded-lg">ব্যাখ্যা: {q.explanation_bn}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
