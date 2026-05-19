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
      const { data, error: qErr } = await fromTable("attempts")
        .select(
          "id, status, score, max_score, total_questions, correct_count, submitted_at, started_at, chapter_id",
        )
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(50);

      if (!alive) return;
      if (qErr) {
        setError(qErr.message);
        setAttempts([]);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Attempt[];
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
          <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">History</span>
        </nav>

        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-primary">History · ইতিহাস</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">Your practice attempts</h1>
          <p className="mt-2 text-muted-foreground">
            Review what you've practiced, with scores and chapter coverage.
          </p>
        </div>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking session…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">Login required</h2>
            <Button asChild className="mt-4">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading history…
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h2 className="font-semibold text-destructive">Could not load history</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : attempts.length === 0 ? (
          <Card className="paper-sheet p-10 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="exam-heading text-xl font-semibold">No attempts yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Practice a chapter to start building your history.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link to="/subjects">
                  <FileText className="mr-2 h-4 w-4" /> Start Practice
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/mock-test">Open Mock Test</Link>
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
                ? new Date(a.submitted_at).toLocaleString()
                : "In progress";
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
                        {ch?.name ?? "Practice attempt"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{date}</span>
                        {a.status === "submitted" ? (
                          <>
                            <span>
                              Score {toBnDigits(score)} / {toBnDigits(max)} ({pct}%)
                            </span>
                            <span>
                              {toBnDigits(a.correct_count ?? 0)} /{" "}
                              {toBnDigits(a.total_questions ?? 0)} correct
                            </span>
                          </>
                        ) : (
                          <Badge variant="outline">{a.status}</Badge>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/result/$attemptId" params={{ attemptId: a.id }}>
                        View <ChevronRight className="ml-1 h-4 w-4" />
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
