import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/bn";
import {
  Clock,
  FileText,
  Loader2,
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/history")({ component: HistoryPage });

type Attempt = {
  id: string;
  status: string;
  score: number | string | null;
  max_score: number | string | null;
  total_questions: number | null;
  correct_count: number | null;
  submitted_at: string | null;
  started_at: string | null;
  chapter_id: string | null;
};

type Chapter = { id: string; name: string; name_bn: string | null };

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [chapters, setChapters] = useState<Record<string, Chapter>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await fromTable("test_attempts")
        .select(
          "id, score, total_questions, correct_count, completed_at, started_at, chapter_id",
        )
        .order("started_at", { ascending: false })
        .limit(50);

      if (!alive) return;
      if (qErr) {
        setError(qErr.message);
        setAttempts([]);
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        status: r.completed_at ? "submitted" : "in_progress",
        score: r.score as number | null,
        max_score: r.total_questions as number | null,
        total_questions: r.total_questions as number | null,
        correct_count: r.correct_count as number | null,
        submitted_at: (r.completed_at as string | null) ?? null,
        started_at: r.started_at as string | null,
        chapter_id: r.chapter_id as string | null,
      })) as Attempt[];
      setAttempts(rows);

      const chapterIds = Array.from(
        new Set(rows.map((r) => r.chapter_id).filter((id): id is string => !!id)),
      );
      if (chapterIds.length > 0) {
        const { data: chRows } = await fromTable("chapters")
          .select("id, name, name_bn")
          .in("id", chapterIds);
        if (!alive) return;
        const map: Record<string, Chapter> = {};
        for (const c of (chRows ?? []) as Chapter[]) map[c.id] = c;
        setChapters(map);
      }
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">ইতিহাস</span>
        </nav>

        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-primary">ইতিহাস · History</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">আপনার অনুশীলনের ইতিহাস</h1>
          <p className="mt-2 text-muted-foreground">
            কোন অধ্যায়ে কেমন স্কোর — সব জমা দেওয়া অনুশীলন এক জায়গায়।
          </p>
        </div>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> সেশন যাচাই হচ্ছে…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">লগইন প্রয়োজন</h2>
            <Button asChild className="mt-4">
              <Link to="/auth">লগইন / সাইন আপ</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> ইতিহাস লোড হচ্ছে…
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h2 className="font-semibold text-destructive">ইতিহাস লোড করা যায়নি</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : attempts.length === 0 ? (
          <Card className="paper-sheet p-10 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="exam-heading text-xl font-semibold">এখনো কোনো অনুশীলন নেই</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              একটি অধ্যায় অনুশীলন করলে এখানে ইতিহাস জমা হবে।
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link to="/subjects">
                  <FileText className="mr-2 h-4 w-4" /> অনুশীলন শুরু করুন
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/mock-test">মক টেস্ট দিন</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => {
              const ch = a.chapter_id ? chapters[a.chapter_id] : null;
              const score = Number(a.score ?? 0);
              const max = Number(a.max_score ?? 0);
              const pct = max > 0 ? Math.round((score / max) * 100) : 0;
              const date = a.submitted_at
                ? new Date(a.submitted_at).toLocaleString("bn-BD")
                : "চলমান";
              return (
                <Card key={a.id} className="paper-sheet p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                      {a.status === "submitted" ? (
                        pct >= 50 ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="exam-heading font-semibold truncate">
                        {ch?.name ?? "অনুশীলন"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{date}</span>
                        {a.status === "submitted" ? (
                          <>
                            <span>
                              নম্বর {toBnDigits(score)} / {toBnDigits(max)} ({pct}%)
                            </span>
                            <span>
                              {toBnDigits(a.correct_count ?? 0)} /{" "}
                              {toBnDigits(a.total_questions ?? 0)} সঠিক
                            </span>
                          </>
                        ) : (
                          <Badge variant="outline">{a.status}</Badge>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/result/$attemptId" params={{ attemptId: a.id }}>
                        দেখুন <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
